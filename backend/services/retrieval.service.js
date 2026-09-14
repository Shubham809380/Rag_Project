import { TaskType } from '@google/generative-ai';
import pool from '../db.js';
import config from '../config/index.js';
import * as embeddingService from './embedding.service.js';
import * as pineconeService from './pinecone.service.js';
import { logUsage } from './usage.service.js';

// ─── Keyword scoring (reused from pipeline) ────────────────────────────────
function extractKeywords(query) {
  return query.toLowerCase().replace(/[^\w\s@.\-+#]/g, ' ').split(/\s+/).filter(w => w.length > 1);
}

export function computeKeywordScore(query, content) {
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

export function hybridRerank(matches, question, { maxChunks, threshold } = {}) {
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

  const max = maxChunks || config.pipeline.finalChunksMax;
  const thr = threshold != null ? threshold : config.pipeline.similarityThreshold;
  const diverse = mmrDiversity(deduped, { lambda: 0.7, maxChunks: max });
  return diverse.filter(s => (s.combinedScore || 0) >= thr).slice(0, max);
}

async function keywordSearchDB(question, userId, fileIds, topK) {
  try {
    const keywords = extractKeywords(question).slice(0, 12).join(' & ');
    if (!keywords) return [];
    const params = [keywords];
    let where = `user_id = $${params.length}`;
    if (fileIds && fileIds.length > 0) {
      params.push(fileIds);
      where += ` AND document_id = ANY($${params.length}::uuid[])`;
    }
    // Convert fileIds → document ids first via documents table
    const result = await pool.query(
      `SELECT dc.id, dc.text, dc.section, dc.page, dc.chunk_index, d.file_name, d.id AS document_id,
              ts_rank_cd(dc.search_tsv, query) AS rank
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id,
              to_tsquery('english', $1) query
        WHERE dc.user_id = $${params.length} AND dc.search_tsv @@ query
        ORDER BY rank DESC LIMIT $${params.length + 1}`,
      [...params, topK]
    );
    return result.rows.map(r => ({
      id: r.id,
      score: r.rank || 0,
      metadata: {
        pageContent: r.text, source: r.file_name, page: r.page,
        section: r.section, chunkIndex: r.chunk_index, documentId: r.document_id,
      },
    }));
  } catch (err) {
    // Fallback: in-memory keyword over last chunks is not available; just return []
    return [];
  }
}

/**
 * Run hybrid retrieval (vector + keyword) and rerank.
 * fileId: a single pinecone file id, or kbId to filter by knowledge base.
 */
export async function hybridRetrieve({ question, userId, fileId, kbId, topK, ragMode = 'hybrid' }) {
  const embedResult = await embeddingService.embedSingle(question, {
    retries: 3, taskType: TaskType.RETRIEVAL_QUERY, label: 'retrieve',
  });
  if (!embedResult.success) {
    throw new Error(`Query embedding failed: ${embedResult.error}`);
  }

  const filter = { userId };
  const filterStrs = [];
  const filterParams = [];

  if (kbId) {
    // Resolve which documents belong to this KB by pinecone_file_id
    const kbDocs = await pool.query(
      `SELECT pinecone_file_id FROM documents WHERE user_id=$1 AND knowledge_base_id=$2`,
      [userId, kbId]
    );
    const fileIds = kbDocs.rows.map(r => r.pinecone_file_id);
    if (fileIds.length > 0) {
      filter.fileId = { $in: fileIds };
    }
    filterStrs.push('knowledge_base_id = $1');
    filterParams.push(kbId);
  } else if (fileId) {
    filter.fileId = fileId;
    filterStrs.push('pinecone_file_id = $1');
    filterParams.push(fileId);
  }

  const limit = topK || config.pipeline.queryTopK;
  const { matches, duration } = await pineconeService.queryVectors(embedResult.vector, {
    topK: limit, filter,
  });

  const keywordTopK = Math.max(limit, 15);
  let dbKeywords = [];
  let docIdsForKB = null;
  if (kbId) {
    docIdsForKB = (await pool.query(
      `SELECT id FROM documents WHERE user_id=$1 AND knowledge_base_id=$2`, [userId, kbId]
    )).rows.map(r => r.id);
  } else if (fileId) {
    docIdsForKB = (await pool.query(
      `SELECT id FROM documents WHERE user_id=$1 AND pinecone_file_id=$2`, [userId, fileId]
    )).rows.map(r => r.id);
  }
  dbKeywords = await keywordSearchDB(question, userId, docIdsForKB, keywordTopK);
  if (dbKeywords.length > 0 && !(ragMode === 'semantic')) {
    // merge keyword matches into vector matches for hybrid rerank
    const existing = new Set(matches.map(m => (m.metadata?.pageContent || '').toLowerCase()));
    for (const k of dbKeywords) {
      if (!existing.has((k.metadata?.pageContent || '').toLowerCase())) {
        matches.push({ ...k, source: 'keyword' });
      }
    }
  }

  const reranked = hybridRerank(matches, question, { maxChunks: Math.min(8, topK || config.pipeline.finalChunksMax) });
  logUsage({
    userId, type: 'retrieval', query: question,
    chunksRetrieved: reranked.length,
    confidence: reranked.length ? 'medium' : 'low',
    latencyMs: duration, success: true,
  });
  return { chunks: reranked, duration, searchDuration: duration };
}
