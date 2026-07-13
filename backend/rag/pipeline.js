/**
 * RAG Pipeline - Production-Grade
 *
 * INGESTION:  Parse -> Clean -> Chunk (700-1000 chars, 150-200 overlap) -> Embed -> Store
 * QUERY:      Embed -> Search (topK=25) -> Threshold -> MMR Diversity -> Hybrid Rerank -> Top 5-8 -> LLM
 *
 * Error handling: retries with exponential backoff for all external calls.
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Pinecone } from '@pinecone-database/pinecone';
import { chunkByPages } from './chunker.js';
import { buildRAGPrompt, buildContext, generateFollowUps } from './prompts.js';

// --- Constants ---

const INGEST_BATCH = 20;
const QUERY_TOP_K = 25;
const FINAL_CHUNKS_MIN = 5;
const FINAL_CHUNKS_MAX = 8;
const SIMILARITY_THRESHOLD = 0.15;

const LLM_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];
const EMBED_MODEL = 'gemini-embedding-001';

// --- Retry helper ---

const isVercel = !!process.env.VERCEL;
const PIPELINE_TIMEOUT_MS = isVercel ? 40000 : 120000;

async function withRetry(fn, { label = 'operation', maxRetries = 3, baseDelay = 1000, maxDelay = 15000 } = {}) {
  const retries = isVercel ? 1 : maxRetries;
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const status = err.status || err.statusCode || 0;
      const isRetryable = status === 429 || status === 503 || status === 500 || (err.message && (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT')));
      if (!isRetryable || attempt === retries) throw err;
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500, maxDelay);
      console.log(`    [RETRY] ${label} attempt ${attempt}/${retries} failed (status=${status}), retrying in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// --- Singletons ---

let _pineconeClient = null;
let _pineconeIndex = null;
let _embeddings = null;

function getPineconeClient() {
  if (!_pineconeClient) { _pineconeClient = new Pinecone(); }
  return _pineconeClient;
}

export function getPineconeIndex() {
  if (!_pineconeIndex) {
    _pineconeIndex = getPineconeClient().Index(process.env.PINECONE_INDEX_NAME, process.env.PINECONE_HOST || undefined);
  }
  return _pineconeIndex;
}

export function getEmbeddings() {
  if (!_embeddings) {
    _embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: EMBED_MODEL,
    });
  }
  return _embeddings;
}

// --- KEYWORD MATCHING ---

function extractKeywords(query) {
  return query
    .toLowerCase()
    .replace(/[^\w\s@.\-+#]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

function computeKeywordScore(query, content) {
  const lowerQuery = query.toLowerCase();
  const lowerContent = content.toLowerCase();
  let score = 0;

  if (lowerContent.includes(lowerQuery)) {
    score += 1.0;
  }

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return Math.min(score, 1.0);

  let matchedCount = 0;
  for (const kw of keywords) {
    if (lowerContent.includes(kw)) {
      matchedCount++;
      if (kw.includes('@') || /^\+?\d+/.test(kw) || /^\d{5,}/.test(kw)) {
        score += 0.5;
      } else {
        score += 0.2;
      }
    }
  }

  if (matchedCount === keywords.length) score += 0.3;
  return Math.min(score, 1.0);
}

// --- MMR DIVERSITY ---

function mmrDiversity(sorted, { lambda = 0.7, maxChunks = 12 } = {}) {
  if (sorted.length <= 1) return sorted;
  if (sorted.length <= maxChunks) return sorted;

  const selected = [sorted[0]];
  const remaining = sorted.slice(1);

  while (selected.length < maxChunks && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].combinedScore || 0;
      let maxSim = 0;
      for (const sel of selected) {
        const sim = cosineSimilarity(remaining[i].metadata?.pageContent || '', sel.metadata?.pageContent || '');
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

function cosineSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// --- DOCUMENT PARSING ---

async function parsePDF(filePath) {
  const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf');
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();
  const pageMap = {};
  for (const doc of docs) {
    const pageNum = doc.metadata?.loc?.pageNumber || Object.keys(pageMap).length + 1;
    if (!pageMap[pageNum]) pageMap[pageNum] = '';
    pageMap[pageNum] += doc.pageContent + '\n';
  }
  return Object.entries(pageMap).map(([pageNum, text]) => ({
    pageNumber: parseInt(pageNum),
    text: text.trim(),
  }));
}

async function parseDOCX(filePath) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  const pages = text.split(/\f/);
  if (pages.length <= 1) return [{ pageNumber: 1, text }];
  return pages.map((p, i) => ({ pageNumber: i + 1, text: p.trim() })).filter(p => p.text);
}

function parseTXT(filePath) {
  let text = fs.readFileSync(filePath, 'utf-8');
  text = text.replace(/^\uFEFF/, '');
  if (!text || text.trim().length === 0) {
    const raw = fs.readFileSync(filePath);
    text = raw.toString('latin1');
  }
  console.log(`  [PARSE-TXT] File: ${filePath} | Size: ${fs.statSync(filePath).size} bytes | Chars: ${text.length} | Preview: "${text.substring(0, 200).replace(/\n/g, '\\n')}"`);
  return [{ pageNumber: 1, text }];
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  if (lines.length === 0) return [{ pageNumber: 1, text: '' }];
  const header = lines[0];
  const textParts = [`CSV Data with columns: ${header}`];
  for (const line of lines.slice(1)) {
    if (line.trim()) textParts.push(line.trim());
  }
  return [{ pageNumber: 1, text: textParts.join('\n') }];
}

async function parseDocument(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf': return parsePDF(filePath);
    case '.docx': return parseDOCX(filePath);
    case '.txt': return parseTXT(filePath);
    case '.csv': return parseCSV(filePath);
    default: throw new Error(`Unsupported file format: ${ext}`);
  }
}

// --- INGESTION PIPELINE ---

export async function ingestDocument(file, user) {
  const filePath = file.path;
  const fileName = file.originalname;
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const ingestStart = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  INGEST: ${fileName} (${(file.size / 1024).toFixed(1)} KB)`);
  console.log(`${'='.repeat(60)}`);

  // Step 1: Parse
  const parseStart = Date.now();
  const pages = await parseDocument(filePath, fileName);
  const totalPages = pages.length;
  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  const parseTime = Date.now() - parseStart;

  console.log(`  [PARSE] Pages: ${totalPages} | Chars: ${totalChars.toLocaleString()} | ${parseTime}ms`);

  if (totalChars === 0) {
    console.error(`  [ERROR] No text extracted from ${fileName}`);
    try { fs.unlinkSync(filePath); } catch {}
    return { fileId, fileName, pages: totalPages, chunks: 0, totalChars: 0, chunkCount: 0, error: 'No readable text was extracted from this document.' };
  }

  // Step 2: Chunk (700-1000 chars, 150-200 overlap)
  const chunkStart = Date.now();
  const chunks = chunkByPages(pages, {
    source: fileName,
    fileId,
    userId: user?.id || 'anonymous',
  });
  const chunkTime = Date.now() - chunkStart;

  console.log(`  [CHUNK] Total chunks: ${chunks.length} | ${chunkTime}ms`);

  if (chunks.length === 0) {
    console.error(`  [ERROR] 0 chunks produced from ${totalChars} chars for ${fileName}`);
    try { fs.unlinkSync(filePath); } catch {}
    return { fileId, fileName, pages: totalPages, chunks: 0, totalChars, chunkCount: 0, error: `Text extracted (${totalChars} chars) but too short to create chunks.` };
  }

  // Step 3: Embed & Store (with retries)
  const embedStart = Date.now();
  const embeddings = getEmbeddings();
  const pineconeIndex = getPineconeIndex();
  let totalUpserted = 0;
  let totalSkipped = 0;

  console.log(`  [EMBED & UPLOAD] ${chunks.length} chunks in ${Math.ceil(chunks.length / INGEST_BATCH)} batches`);
  for (let i = 0; i < chunks.length; i += INGEST_BATCH) {
    const batch = chunks.slice(i, i + INGEST_BATCH);
    const texts = batch.map(c => c.pageContent);
    const batchStart = Date.now();

    const vectors = await withRetry(
      () => embeddings.embedDocuments(texts),
      { label: `embed-batch-${Math.floor(i/INGEST_BATCH)+1}`, maxRetries: 3, baseDelay: 2000 }
    );

    const embedTime = Date.now() - batchStart;

    const records = [];
    for (let idx = 0; idx < batch.length; idx++) {
      if (vectors[idx] && vectors[idx].length > 0) {
        const content = batch[idx].pageContent;
        records.push({
          id: `${fileId}-chunk-${i + idx}`,
          values: vectors[idx],
          metadata: {
            pageContent: content,
            source: fileName,
            fileId,
            userId: user?.id || 'anonymous',
            page: batch[idx].metadata?.page || 0,
            section: batch[idx].metadata?.section || '',
            chunkIndex: batch[idx].metadata?.chunkIndex || i + idx,
          },
        });
      } else {
        totalSkipped++;
      }
    }

    if (records.length > 0) {
      const upsertStart = Date.now();
      await withRetry(
        () => pineconeIndex.upsert({ records }),
        { label: `upsert-batch-${Math.floor(i/INGEST_BATCH)+1}`, maxRetries: 3, baseDelay: 2000 }
      );
      const upsertTime = Date.now() - upsertStart;
      totalUpserted += records.length;
      console.log(`    Batch ${Math.floor(i / INGEST_BATCH) + 1}: ${batch.length} chunks -> ${vectors.length} vectors (embed: ${embedTime}ms, upsert: ${upsertTime}ms)`);
    } else {
      console.log(`    Batch ${Math.floor(i / INGEST_BATCH) + 1}: ${batch.length} chunks -> 0 records (all skipped)`);
    }
  }

  try { fs.unlinkSync(filePath); } catch {}

  const totalTime = Date.now() - ingestStart;
  console.log(`  [DONE] ${totalUpserted} vectors upserted, ${totalSkipped} skipped | Total: ${totalTime}ms`);
  console.log(`${'='.repeat(60)}\n`);

  if (totalUpserted === 0) {
    return { fileId, fileName, pages: totalPages, chunks: 0, totalChars, chunkCount: chunks.length, error: `Parsed ${totalChars} chars into ${chunks.length} chunks but all embeddings failed (${totalSkipped} skipped). Check API key.` };
  }

  return { fileId, fileName, pages: totalPages, chunks: totalUpserted, totalChars, chunkCount: chunks.length };
}

// --- HYBRID QUERY PIPELINE ---

function hybridRerank(matches, question, { maxChunks = 8 } = {}) {
  console.log(`    [HYBRID] Scoring ${matches.length} candidates`);

  const scored = matches.map(m => {
    const content = m.metadata?.pageContent || '';
    const vectorScore = m.score || 0;
    const kwScore = computeKeywordScore(question, content);
    const combinedScore = vectorScore * 0.5 + kwScore * 0.5;

    return {
      ...m,
      vectorScore,
      keywordScore: kwScore,
      combinedScore,
    };
  });

  scored.sort((a, b) => b.combinedScore - a.combinedScore);

  for (let i = 0; i < scored.length; i++) {
    const s = scored[i];
    const preview = (s.metadata?.pageContent || '').substring(0, 100).replace(/\n/g, ' ');
    const marker = s.keywordScore > 0.3 ? ' KEYWORD' : '';
    console.log(`      #${i + 1} combined=${s.combinedScore.toFixed(3)} (vec=${s.vectorScore.toFixed(3)} kw=${s.keywordScore.toFixed(3)}) | "${preview}..."${marker}`);
  }

  // Deduplicate
  const deduped = [];
  const seen = new Set();
  for (const s of scored) {
    const fp = (s.metadata?.pageContent || '').substring(0, 200).trim().toLowerCase();
    if (seen.has(fp)) continue;
    seen.add(fp);
    deduped.push(s);
  }

  // MMR diversity
  const diverse = mmrDiversity(deduped, { lambda: 0.7, maxChunks: FINAL_CHUNKS_MAX });

  // Filter by similarity threshold
  const filtered = diverse.filter(s => (s.combinedScore || 0) >= SIMILARITY_THRESHOLD);

  const selected = filtered.slice(0, FINAL_CHUNKS_MAX);
  console.log(`    [HYBRID] Selected ${selected.length} chunks (after threshold + MMR)`);
  return selected;
}

export async function queryPipeline({ question, fileId, userId, conversationId, previousMessages = [] }) {
  const pipelineStart = Date.now();
  const deadline = pipelineStart + PIPELINE_TIMEOUT_MS;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  QUERY: "${question}"`);
  console.log(`  Timeout: ${PIPELINE_TIMEOUT_MS}ms | Vercel: ${isVercel}`);
  console.log(`${'='.repeat(60)}`);

  function checkDeadline(step) {
    if (Date.now() > deadline) {
      const elapsed = Date.now() - pipelineStart;
      throw new Error(`Pipeline timeout at ${step}: exceeded ${PIPELINE_TIMEOUT_MS}ms limit (${Math.round(elapsed)}ms elapsed)`);
    }
  }

  // Step 1: Embed query
  checkDeadline('embed-query');
  const embedStart = Date.now();
  const embeddings = getEmbeddings();
  const queryVector = await withRetry(
    () => embeddings.embedQuery(question),
    { label: 'embed-query', maxRetries: 1, baseDelay: 1000 }
  );
  const embedTime = Date.now() - embedStart;
  const keywords = extractKeywords(question);
  console.log(`  [EMBED] ${queryVector.length}d vector | ${embedTime}ms`);
  console.log(`  [QUERY] Keywords: [${keywords.join(', ')}]`);

  // Step 2: Vector search
  checkDeadline('pinecone-query');
  const searchStart = Date.now();
  const pineconeIndex = getPineconeIndex();
  const filter = { userId: userId };
  if (fileId) filter.fileId = fileId;

  console.log(`  [SEARCH] topK=${QUERY_TOP_K}, filter=${JSON.stringify(filter)}`);
  const queryResponse = await withRetry(
    () => pineconeIndex.query({
      vector: queryVector,
      topK: QUERY_TOP_K,
      includeMetadata: true,
      filter,
    }),
    { label: 'pinecone-query', maxRetries: 1, baseDelay: 1000 }
  );

  const searchTime = Date.now() - searchStart;
  const matches = queryResponse.matches || [];
  console.log(`  [SEARCH] ${matches.length} matches | ${searchTime}ms`);

  if (matches.length === 0) {
    console.log(`  [RESULT] No vectors found in Pinecone for filter=${JSON.stringify(filter)}`);
    const totalTime = Date.now() - pipelineStart;
    console.log(`  [TIMING] Pipeline total: ${totalTime}ms (no matches)`);
    console.log(`${'='.repeat(60)}\n`);
    return {
      answer: 'I couldn\'t find this information in your uploaded documents. The document may not have been processed successfully. Please try uploading it again.',
      sources: [],
      confidence: 'low',
      followUps: generateFollowUps(question, ''),
      model: null,
      chunkCount: 0,
      conversationId,
    };
  }

  for (let i = 0; i < Math.min(matches.length, 5); i++) {
    const m = matches[i];
    const preview = (m.metadata?.pageContent || '').substring(0, 100).replace(/\n/g, ' ');
    console.log(`    Raw #${i + 1}: score=${(m.score || 0).toFixed(4)} | page=${m.metadata?.page || '?'} | "${preview}..."`);
  }

  // Step 3: Hybrid rerank (vector 0.5 + keyword 0.5 + MMR + threshold + top 5-8)
  const rerankStart = Date.now();
  console.log(`  [RERANK] Hybrid scoring + MMR diversity`);
  const reranked = hybridRerank(matches, question, { maxChunks: FINAL_CHUNKS_MAX });
  const rerankTime = Date.now() - rerankStart;
  console.log(`  [RERANK] ${reranked.length} selected | ${rerankTime}ms`);

  if (reranked.length === 0) {
    console.log(`  [RESULT] No chunks after threshold - returning not found`);
    const totalTime = Date.now() - pipelineStart;
    console.log(`  [TIMING] Pipeline total: ${totalTime}ms (no chunks above threshold)`);
    console.log(`${'='.repeat(60)}\n`);
    return {
      answer: 'I couldn\'t find this information in your uploaded documents.',
      sources: [],
      confidence: 'low',
      followUps: generateFollowUps(question, ''),
      model: null,
      chunkCount: 0,
      conversationId,
    };
  }

  // Step 4: Build context
  const contextChunks = reranked.map(m => ({
    pageContent: m.metadata?.pageContent || '',
    metadata: {
      source: m.metadata?.source || 'Unknown',
      page: m.metadata?.page || 0,
      section: m.metadata?.section || '',
      score: m.combinedScore ?? m.score,
    },
  }));

  const context = buildContext(contextChunks);
  console.log(`  [CONTEXT] ${context.length} chars from ${contextChunks.length} chunks`);

  // Step 5: Build sources for frontend
  const sources = [];
  const seenSources = new Set();
  for (const chunk of contextChunks) {
    const key = `${chunk.metadata.source}-p${chunk.metadata.page}`;
    if (seenSources.has(key)) continue;
    seenSources.add(key);
    sources.push({
      document: chunk.metadata.source,
      page: chunk.metadata.page,
      section: chunk.metadata.section || undefined,
      excerpt: chunk.pageContent.substring(0, 500),
      score: chunk.metadata.score || 0,
    });
  }

  // Step 6: Build LLM messages
  checkDeadline('build-context');
  const history = previousMessages.slice(-6);
  const llmMessages = buildRAGPrompt(context, question, history);

  // Step 7: Call LLM (with retries per model)
  let llmResponse = null;
  let usedModel = null;
  const llmModels = isVercel ? LLM_MODELS.slice(0, 1) : LLM_MODELS;

  for (const modelName of llmModels) {
    checkDeadline(`llm-${modelName}`);
    const llmStart = Date.now();
    try {
      const llm = new ChatGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        model: modelName,
        temperature: 0.2,
        maxRetries: 0,
        timeout: isVercel ? 15000 : 60000,
      });

      console.log(`  [LLM] Trying ${modelName} (timeout: ${isVercel ? 15 : 60}s)...`);
      llmResponse = await llm.invoke(llmMessages);
      usedModel = modelName;
      const llmTime = Date.now() - llmStart;
      console.log(`  [LLM] OK via ${modelName} | ${llmTime}ms`);
      break;
    } catch (err) {
      const llmTime = Date.now() - llmStart;
      const status = err.status || err.statusCode || 0;
      console.log(`  [LLM] FAIL ${modelName}: status=${status} ${llmTime}ms ${err.message ? err.message.substring(0, 100) : ''}`);
    }
  }

  if (!llmResponse) {
    console.log(`  [RESULT] All LLM models failed`);
    const totalTime = Date.now() - pipelineStart;
    console.log(`  [TIMING] Pipeline total: ${totalTime}ms (all LLMs failed)`);
    console.log(`${'='.repeat(60)}\n`);
    return {
      answer: 'AI service temporarily unavailable due to rate limiting. Please try again in a moment.',
      sources, confidence: 'low', followUps: [], model: null,
      chunkCount: reranked.length, conversationId,
    };
  }

  const answer = llmResponse.content;
  console.log(`  [ANSWER] ${answer.length} chars`);

  // Confidence
  const avgScore = reranked.reduce((s, m) => s + (m.combinedScore ?? 0), 0) / reranked.length;
  const hasKeywordHit = reranked.some(m => m.keywordScore > 0.3);
  let confidence = 'low';
  if (hasKeywordHit && avgScore >= 0.5) confidence = 'high';
  else if (avgScore >= 0.35) confidence = 'medium';

  const followUps = generateFollowUps(question, answer);

  const response = {
    answer, sources, confidence, followUps,
    model: usedModel, chunkCount: reranked.length, conversationId,
  };

  const totalTime = Date.now() - pipelineStart;
  console.log(`  [RESULT] confidence=${confidence} | sources=${sources.length} | model=${usedModel} | chunks=${reranked.length}`);
  console.log(`  [TIMING] Pipeline total: ${totalTime}ms (embed: ${embedTime}ms, search: ${searchTime}ms, rerank: ${rerankTime}ms)`);
  console.log(`${'='.repeat(60)}\n`);

  return response;
}
