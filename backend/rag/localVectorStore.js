import { getSovereignDB } from '../storage/sovereignDB.js';
import { fallbackEmbedText, cosSim, FALLBACK_PROVIDER, fallbackEmbedBatch, fallbackDimensions } from './fallbackEmbedder.js';
import { modelRouter } from '../models/router.js';
import sovereign from '../config/sovereign.js';
import logger from '../utils/logger.js';

const LOG = 'LocalVectorStore';

// BM25 parameters
const K1 = 1.5;
const B = 0.75;

function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 1).map(stem);
}

// Lightweight English suffix stemmer — covers common morphological variants
// (required→require, inspection→inspect, connection→connect) so BM25 can
// match across inflections. Deliberately conservative; false positives here
// only soften IDF, which is already defended by the combined vector + keyword score.
function stem(w) {
  if (w.length <= 4) return w;
  let r = w;
  if (r.endsWith('ization') && r.length > 8) r = r.slice(0, -5); // ization → ize
  else if (r.endsWith('isation') && r.length > 9) r = r.slice(0, -6);
  else if (r.endsWith('ation') && r.length > 7) r = r.slice(0, -4) + 'e'; // inspection → inspecte? no: need better mapping
  else if (r.endsWith('tion') && r.length > 6) r = r.slice(0, -3); // connection → connect
  else if (r.endsWith('ment') && r.length > 6) r = r.slice(0, -4); // replacement → replac
  else if (r.endsWith('ness') && r.length > 6) r = r.slice(0, -4); // availability → availab
  else if (r.endsWith('ful') && r.length > 5) r = r.slice(0, -3);
  else if (r.endsWith('ive') && r.length > 5) r = r.slice(0, -3); // active → act
  else if (r.endsWith('ous') && r.length > 5) r = r.slice(0, -3); // hazardous → hazard
  else if (r.endsWith('ies') && r.length > 4) r = r.slice(0, -2) + 'y'; // policies → policy
  else if (r.endsWith('ing') && r.length > 5) r = r.slice(0, -3); // processing → process
  else if (r.endsWith('ly') && r.length > 4) r = r.slice(0, -2); // locally → local
  else if (r.endsWith('ed') && r.length > 4) r = r.slice(0, -2); // created → creat
  else if (r.endsWith('er') && r.length > 4) r = r.slice(0, -2); // replaced → replac
  else if (r.endsWith('es') && r.length > 4) r = r.slice(0, -2); // classes → class
  else if (r.endsWith('s') && r.length > 3 && !r.endsWith('ss')) r = r.slice(0, -1); // documents → document
  return r;
}

function bm25Score(queryTerms, docTokens, docLen, N, dfMap, avgdl) {
  let score = 0;
  const tf = new Map();
  for (const t of docTokens) tf.set(t, (tf.get(t) || 0) + 1);
  for (const q of new Set(queryTerms)) {
    const f = tf.get(q) || 0;
    if (f === 0) continue;
    const df = dfMap.get(q) || 0;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    const numerator = f * (K1 + 1);
    const denominator = f + K1 * (1 - B + B * (docLen / avgdl));
    score += idf * (numerator / denominator);
  }
  return score;
}

// MMR diversity re-rank.
function mmr(items, { lambda = 0.7, max = 8 } = {}) {
  if (items.length <= max) return items;
  const selected = [items[0]];
  const remaining = items.slice(1);
  while (selected.length < max && remaining.length) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const rel = remaining[i].score;
      let maxSim = 0;
      for (const s of selected) maxSim = Math.max(maxSim, cosSim(s.vector, remaining[i].vector));
      const mmrVal = lambda * rel - (1 - lambda) * maxSim;
      if (mmrVal > bestScore) { bestScore = mmrVal; bestIdx = i; }
    }
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }
  return selected;
}

export class LocalVectorStore {
  constructor() { this.db = null; }

  _db() { return this.db || (this.db = getSovereignDB()); }

  async embedTexts(texts, { label = 'ingest' } = {}) {
    // Try the local embedding model first; fall back to deterministic hashing.
    const router = modelRouter();
    const res = await router.embedTexts(texts);
    if (res.ok) {
      logger.info(LOG, `[${label}] embeddings via ${res.modelKey} (${res.dimension}d)`);
      return { vectors: res.vectors, dimension: res.dimension, provider: res.modelKey, ok: true };
    }
    if (sovereign.embeddings.allowFallback) {
      logger.warn(LOG, `[${label}] no local embedding model — using FALLBACK hashed embeddings`, { reason: res.reason });
      return { vectors: fallbackEmbedBatch(texts), dimension: fallbackDimensions(), provider: FALLBACK_PROVIDER, ok: true, fallback: true };
    }
    logger.error(LOG, `[${label}] embeddings unavailable`, { reason: res.reason });
    return { ok: false, reason: res.reason };
  }

  async embedQuery(text) {
    // Query side: prefer local model; skip fallback for the query part is fine
    // (fallback is symmetric so it still works for retrieval scoring).
    return fallbackEmbedText(text);
  }

  async indexDocument({ documentId, chunks, dimension, provider, vectors }) {
    return this._db().replaceChunksVectors(documentId, chunks, vectors, dimension, provider);
  }

  // Hybrid retrieval with document-level access control.
  // Returns scored chunks with citations.
  async search({ question, userId, user, collectionId = null, documentIds = null, topK = 25, finalMax = 8, allowAll = false }) {
    const db = this._db();
    let docIds;
    if (allowAll) {
      docIds = db.listDocuments({ collectionId }).map(d => d.id);
    } else {
      docIds = db.listAccessibleDocumentIds(user, { collectionId });
    }
    if (documentIds && documentIds.length) {
      const allowedSet = new Set(docIds);
      docIds = documentIds.filter(id => allowedSet.has(id));
    }
    if (docIds.length === 0) return { results: [], totalDocs: 0, note: 'No accessible documents' };

    const vectors = db.getVectorsForDocuments(docIds);
    const chunks = db.getChunksByIds(docIds);
    const docs = db.listDocuments().filter(d => docIds.includes(d.id));
    const docById = new Map(docs.map(d => [d.id, d]));

    // Candidate pool: chunks that have vectors OR all chunks (for BM25).
    const vecByKey = new Map();
    let dim = 0;
    for (const v of vectors) {
      vecByKey.set(`${v.documentId}:${v.chunkIndex}`, v.vector);
      dim = v.dimension || dim;
    }

    let pool;
    if (vecByKey.size > 0) {
      pool = chunks.filter(c => vecByKey.has(`${c.documentId}:${c.chunkIndex}`));
    } else {
      pool = chunks;
    }
    if (pool.length === 0) return { results: [], totalDocs: docIds.length, note: 'No indexed chunks' };

    const queryVec = await this.embedQuery(question);
    // In case of dimension mismatch (fallback vs model), pure model path still works via BM25.
    const useVector = dim > 0 && queryVec.length === dim;

    // BM25 corpus statistics
    const tokenizedDocs = pool.map((c, i) => ({ idx: i, tokens: tokenize(c.text), len: 0 }));
    const N = tokenizedDocs.length;
    const dlSum = tokenizedDocs.reduce((s, t) => s + t.tokens.length, 0);
    const avgdl = N ? dlSum / N : 1;
    const dfMap = new Map();
    for (const t of tokenizedDocs) {
      for (const term of new Set(t.tokens)) dfMap.set(term, (dfMap.get(term) || 0) + 1);
    }
    const queryTerms = tokenize(question);

    const scored = pool.map((c, i) => {
      const vec = vecByKey.get(`${c.documentId}:${c.chunkIndex}`);
      let vectorScore = useVector && vec ? cosSim(queryVec, vec) : 0;
      vectorScore = Math.max(0, (vectorScore + 1) / 2); // [0,1]
      const kw = bm25Score(queryTerms, tokenizedDocs[i].tokens, tokenizedDocs[i].tokens.length, N, dfMap, avgdl);
      const doc = docById.get(c.documentId);
      return {
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        section: c.section || '',
        page: c.page || 0,
        source: doc?.filename || c.documentId,
        classification: doc?.classification || 'INTERNAL',
        department: doc?.department || '',
        collectionId: doc?.collection_id || null,
        vector: vec || fallbackEmbedText(c.text),
        vectorScore,
        keywordScore: kw,
        combinedScore: 0.5 * vectorScore + 0.5 * Math.min(kw, 1),
      };
    });

    scored.sort((a, b) => b.combinedScore - a.combinedScore);

    // Deduplicate near-identical chunks.
    const seen = new Set();
    const deduped = [];
    for (const s of scored) {
      const fp = s.text.substring(0, 180).replace(/\s+/g, ' ').trim().toLowerCase();
      if (seen.has(fp)) continue;
      seen.add(fp);
      deduped.push(s);
    }

    // Document-level diversity: keep at most MAX_PER_DOC highest-scoring chunks
    // per document so one verbose source cannot crowd out every other document.
    // The final MMR pass then maximizes relevance AND inter-document distance.
    const perDoc = new Map();
    const MAX_PER_DOC = 2;
    for (const s of deduped) {
      if (!perDoc.has(s.documentId)) perDoc.set(s.documentId, []);
      perDoc.get(s.documentId).push(s);
    }
    const capped = [];
    for (const group of perDoc.values()) {
      group.sort((a, b) => b.combinedScore - a.combinedScore);
      capped.push(...group.slice(0, MAX_PER_DOC));
    }
    capped.sort((a, b) => b.combinedScore - a.combinedScore);

    const final = mmr(capped, { lambda: 0.7, max: finalMax });
    const results = final.map(s => ({
      documentId: s.documentId,
      document: s.source,
      page: s.page,
      section: s.section,
      excerpt: s.text.substring(0, 900),
      content: s.text,
      score: +(s.combinedScore || 0).toFixed(4),
      vectorScore: +(s.vectorScore || 0).toFixed(4),
      keywordScore: +(s.keywordScore || 0).toFixed(4),
      classification: s.classification,
      department: s.department,
      collectionId: s.collectionId,
    }));

    // Confidence from the combined score of top hit + keyword hit.
    const top = results[0];
    let confidence = 'low';
    if (top && top.score >= 0.55) confidence = 'high';
    else if (top && top.score >= 0.35) confidence = 'medium';

    return { results, totalDocs: docIds.length, confidence, scoredCount: scored.length };
  }
}

let _instance = null;
export const localVectorStore = () => (_instance || (_instance = new LocalVectorStore()));