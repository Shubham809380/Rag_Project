import sovereign from '../config/sovereign.js';

// ─────────────────────────────────────────────────────────────────────────────
// FallbackEmbedder — DETERMINISTIC offline embedding.
//
// Hashed bag-of-tokens (unigram + bigram) into a fixed-dimension vector, L2
// normalized so cosine == dot product. Zero network, zero models, reproducible.
//
// IMPORTANT: this is a LOW-FIDELITY stand-in used only when no local embedding
// model is reachable. It is always labelled `provider: 'fallback'` and the
// retrieval layer boosts BM25/keyword so quality stays usable for demos.
// Production deployments should register a local embedding model.
// ─────────────────────────────────────────────────────────────────────────────

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const FALLBACK_PROVIDER = 'fallback';

export function fallbackEmbedText(text, dim = sovereign.embeddings.fallbackDim) {
  const vec = new Float64Array(dim);
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t.length > 0);

  const feats = new Map();
  const bump = (key) => feats.set(key, (feats.get(key) || 0) + 1);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    bump(t);
    if (i + 1 < tokens.length) bump(`${t} ${tokens[i + 1]}`);
    if (tokens[i].length > 3) bump(t.slice(0, 3)); // stem-ish prefix
  }

  for (const [key, count] of feats) {
    const idx = fnv1a(key) % dim;
    vec[idx] += 1 + Math.log(count); // sublinear tf
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return Array.from(vec);
}

export function cosSim(a, b) {
  if (!a || !b) return 0;
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export function fallbackEmbedBatch(texts, dim = sovereign.embeddings.fallbackDim) {
  return texts.map(t => fallbackEmbedText(t, dim));
}

export function fallbackDimensions() { return sovereign.embeddings.fallbackDim; }