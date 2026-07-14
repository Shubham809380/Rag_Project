import { TaskType } from '@google/generative-ai';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { chunkByPages } from '../rag/chunker.js';
import { buildRAGPrompt, buildContext, generateFollowUps } from '../rag/prompts.js';
import * as embeddingService from './embedding.service.js';
import * as pineconeService from './pinecone.service.js';
import * as documentService from './document.service.js';
import * as llmService from './llm.service.js';

const LOG = 'Pipeline';

export async function ingestDocument(file, user) {
  const ingestStart = Date.now();
  const filePath = file.path;
  const fileName = file.originalname;
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  logger.stage(LOG, `INGEST START: ${fileName}`, { size: `${(file.size / 1024).toFixed(1)}KB`, userId: user?.id });

  const validation = documentService.validateFile(file);
  if (!validation.valid) {
    documentService.cleanupFile(filePath);
    return { fileId, fileName, pages: 0, chunks: 0, error: validation.error, code: 'VALIDATION_FAILED', success: false, stage: 'validation', retryable: false };
  }

  const parseStart = Date.now();
  let pages, totalChars, totalPages;
  try {
    const parsed = await documentService.parseDocument(filePath, fileName);
    pages = parsed.pages;
    totalChars = parsed.totalChars;
    totalPages = parsed.totalPages;
  } catch (parseErr) {
    documentService.cleanupFile(filePath);
    logger.error(LOG, `Parse failed: ${fileName}`, { error: parseErr.message });
    return { fileId, fileName, pages: 0, chunks: 0, error: `Failed to parse document: ${parseErr.message}`, code: 'PARSE_FAILED', success: false, stage: 'parsing', retryable: false };
  }
  logger.timing(LOG, 'Parse', parseStart);

  if (totalChars === 0) {
    documentService.cleanupFile(filePath);
    return { fileId, fileName, pages: totalPages, chunks: 0, totalChars: 0, error: 'No readable text extracted from document.', code: 'EMPTY_DOCUMENT', success: false, stage: 'parsing', retryable: false };
  }

  const chunkStart = Date.now();
  const chunks = chunkByPages(pages, { source: fileName, fileId, userId: user?.id || 'anonymous' });
  logger.timing(LOG, 'Chunk', chunkStart);
  logger.info(LOG, `Chunks created: ${chunks.length}`, { totalChars, avgChunkSize: Math.round(totalChars / chunks.length) });

  if (chunks.length === 0) {
    documentService.cleanupFile(filePath);
    return { fileId, fileName, pages: totalPages, chunks: 0, totalChars, error: 'Text extracted but too short to create chunks.', code: 'NO_CHUNKS', success: false, stage: 'chunking', retryable: false };
  }

  const embedStart = Date.now();
  const allTexts = chunks.map(c => c.pageContent);
  const { results: allVectors, totalSuccess, totalFailed, dimension, duration: embedDuration } = await embeddingService.embedTexts(allTexts, {
    label: `ingest-${fileId}`,
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  });
  logger.timing(LOG, 'Embed', embedStart);

  const expectedDim = embeddingService.getExpectedDimension();
  if (dimension > 0 && dimension !== expectedDim) {
    logger.error(LOG, `DIMENSION MISMATCH: embedding produced ${dimension}d vectors, Pinecone index expects ${expectedDim}d`, {
      embeddingDimension: dimension,
      expectedDimension: expectedDim,
      action: 'Recreate Pinecone index with dimension ' + dimension,
    });
  }

  if (totalSuccess === 0) {
    documentService.cleanupFile(filePath);
    logger.error(LOG, `All ${chunks.length} embeddings failed for ${fileName}`);
    return {
      success: false,
      fileId, fileName, pages: totalPages, chunks: 0, totalChars, chunkCount: chunks.length,
      code: 'EMBEDDING_GENERATION_FAILED',
      stage: 'embedding',
      message: `Embedding generation failed for all ${chunks.length} chunks. Check GEMINI_API_KEY and model availability.`,
      details: `Model: gemini-embedding-001, Chunks: ${chunks.length}, All ${totalFailed} failed`,
      retryable: true,
    };
  }

  const records = [];
  let skippedCount = 0;
  for (let idx = 0; idx < chunks.length; idx++) {
    if (allVectors[idx] && allVectors[idx].length > 0) {
      records.push({
        id: `${fileId}-chunk-${idx}`,
        values: allVectors[idx],
        metadata: {
          pageContent: chunks[idx].pageContent,
          source: fileName,
          fileId,
          userId: user?.id || 'anonymous',
          page: chunks[idx].metadata?.page || 0,
          section: chunks[idx].metadata?.section || '',
          chunkIndex: idx,
        },
      });
    } else {
      skippedCount++;
    }
  }

  const upsertStart = Date.now();
  const { upserted } = await pineconeService.upsertVectors(records, { label: fileId });
  logger.timing(LOG, 'Upsert', upsertStart);

  documentService.cleanupFile(filePath);

  const totalTime = Date.now() - ingestStart;
  logger.stage(LOG, `INGEST DONE: ${fileName}`, {
    pages: totalPages, chunks: upserted, skipped: skippedCount, totalMs: totalTime, dimension,
  });

  if (upserted === 0) {
    return {
      success: false,
      fileId, fileName, pages: totalPages, chunks: 0, totalChars, chunkCount: chunks.length,
      code: 'UPSERT_FAILED', stage: 'pinecone', retryable: true,
      message: `Parsed ${totalChars} chars into ${chunks.length} chunks but Pinecone upsert failed.`,
    };
  }

  return {
    success: true,
    fileId, fileName, pages: totalPages, chunks: upserted, totalChars, chunkCount: chunks.length,
    totalSuccess, totalFailed, dimension,
  };
}

function extractKeywords(query) {
  return query.toLowerCase().replace(/[^\w\s@.\-+#]/g, ' ').split(/\s+/).filter(w => w.length > 1);
}

function computeKeywordScore(query, content) {
  const lowerQuery = query.toLowerCase();
  const lowerContent = content.toLowerCase();
  let score = 0;
  if (lowerContent.includes(lowerQuery)) score += 1.0;
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return Math.min(score, 1.0);
  let matched = 0;
  for (const kw of keywords) {
    if (lowerContent.includes(kw)) {
      matched++;
      score += (kw.includes('@') || /^\+?\d+/.test(kw) || /^\d{5,}/.test(kw)) ? 0.5 : 0.2;
    }
  }
  if (matched === keywords.length) score += 0.3;
  return Math.min(score, 1.0);
}

function cosineSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function mmrDiversity(sorted, { lambda = 0.7, maxChunks = 8 } = {}) {
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
      if (mmr > bestMmr) { bestMmr = mmr; bestIdx = i; }
    }
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }
  return selected;
}

function hybridRerank(matches, question) {
  const scored = matches.map(m => {
    const content = m.metadata?.pageContent || '';
    const vectorScore = m.score || 0;
    const kwScore = computeKeywordScore(question, content);
    return { ...m, vectorScore, keywordScore: kwScore, combinedScore: vectorScore * 0.5 + kwScore * 0.5 };
  });

  scored.sort((a, b) => b.combinedScore - a.combinedScore);

  const deduped = [];
  const seen = new Set();
  for (const s of scored) {
    const fp = (s.metadata?.pageContent || '').substring(0, 200).trim().toLowerCase();
    if (seen.has(fp)) continue;
    seen.add(fp);
    deduped.push(s);
  }

  const diverse = mmrDiversity(deduped, { lambda: 0.7, maxChunks: config.pipeline.finalChunksMax });
  return diverse.filter(s => (s.combinedScore || 0) >= config.pipeline.similarityThreshold).slice(0, config.pipeline.finalChunksMax);
}

export async function queryPipeline({ question, fileId, userId, conversationId, previousMessages = [] }) {
  const pipelineStart = Date.now();
  const deadline = pipelineStart + config.pipeline.timeoutMs;

  logger.stage(LOG, `QUERY: "${question.substring(0, 80)}"`, { userId, fileId: fileId || 'all' });

  function checkDeadline(step) {
    if (Date.now() > deadline) {
      throw new Error(`Pipeline timeout at ${step}: exceeded ${config.pipeline.timeoutMs}ms`);
    }
  }

  checkDeadline('embed-query');
  const embedStart = Date.now();
  const embedResult = await embeddingService.embedSingle(question, {
    retries: 3,
    taskType: TaskType.RETRIEVAL_QUERY,
    label: 'query-embed',
  });
  if (!embedResult.success) {
    throw new Error(`Query embedding failed: ${embedResult.error} (status=${embedResult.status})`);
  }
  const queryVector = embedResult.vector;
  logger.timing(LOG, 'Query embed', embedStart);

  checkDeadline('pinecone-query');
  const searchStart = Date.now();
  const filter = { userId };
  if (fileId) filter.fileId = fileId;
  const { matches, duration: searchDuration } = await pineconeService.queryVectors(queryVector, {
    topK: config.pipeline.queryTopK,
    filter,
  });
  logger.timing(LOG, 'Pinecone search', searchStart);

  if (matches.length === 0) {
    const totalTime = Date.now() - pipelineStart;
    logger.info(LOG, 'No matches found', { totalTime });
    return {
      answer: 'I couldn\'t find this information in your uploaded documents. The document may not have been processed successfully. Please try uploading it again.',
      sources: [], confidence: 'low', followUps: generateFollowUps(question, ''),
      model: null, chunkCount: 0, conversationId,
    };
  }

  checkDeadline('rerank');
  const rerankStart = Date.now();
  const reranked = hybridRerank(matches, question);
  logger.timing(LOG, 'Rerank', rerankStart);

  if (reranked.length === 0) {
    return {
      answer: 'I couldn\'t find this information in your uploaded documents.',
      sources: [], confidence: 'low', followUps: generateFollowUps(question, ''),
      model: null, chunkCount: 0, conversationId,
    };
  }

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
  logger.info(LOG, `Context built: ${context.length} chars from ${contextChunks.length} chunks`);

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

  checkDeadline('llm');
  const history = previousMessages.slice(-6);
  const llmMessages = buildRAGPrompt(context, question, history);

  const llmResult = await llmService.generateResponse(llmMessages);
  if (!llmResult) {
    return {
      answer: 'AI service temporarily unavailable due to rate limiting. Please try again in a moment.',
      sources, confidence: 'low', followUps: [], model: null, chunkCount: reranked.length, conversationId,
    };
  }

  const answer = llmResult.content;
  const avgScore = reranked.reduce((s, m) => s + (m.combinedScore ?? 0), 0) / reranked.length;
  const hasKeywordHit = reranked.some(m => m.keywordScore > 0.3);
  let confidence = 'low';
  if (hasKeywordHit && avgScore >= 0.5) confidence = 'high';
  else if (avgScore >= 0.35) confidence = 'medium';

  const followUps = generateFollowUps(question, answer);
  const totalTime = Date.now() - pipelineStart;

  logger.stage(LOG, 'QUERY DONE', {
    confidence, model: llmResult.model, sources: sources.length,
    chunks: reranked.length, totalMs: totalTime,
  });

  return { answer, sources, confidence, followUps, model: llmResult.model, chunkCount: reranked.length, conversationId };
}
