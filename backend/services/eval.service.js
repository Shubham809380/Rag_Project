import * as aiService from './ai.service.js';
import { hybridRetrieve } from './retrieval.service.js';

// Run one evaluation question through retrieval + generation, then score it.
async function evaluateSingle({ question, userId, kbId, fileId }) {
  const start = Date.now();

  // 1. Retrieve relevant chunks
  const { chunks } = await hybridRetrieve({ question, userId, kbId, fileId, topK: 8 });
  const top = (chunks || []).slice(0, 5).map(c => ({
    text: c.metadata?.pageContent || c.text || '',
    score: c.combinedScore ?? c.score ?? 0,
    source: c.metadata?.source || '',
    page: c.metadata?.page,
  }));
  const topK = 5;
  const retrievedTexts = top.map(t => t.text);
  const relevanceScores = top.map(t => t.score);

  // 2. Generate answer from the evidence
  const sys = 'Answer strictly from the evidence provided. If the evidence cannot answer, say "Insufficient evidence". Do not use outside knowledge.';
  const res = await aiService.generateText([
    { role: 'system', content: sys },
    { role: 'user', content: `Question: ${question}\n\nEvidence:\n${top.map((t, i) => `[S${i + 1}] ${t.text}`).join('\n\n').slice(0, 30000)}` },
  ], { temperature: 0.2 });
  const answer = res?.trim() || '';

  const latencyMs = Date.now() - start;

  // 3. Score with a judge model
  const judge = await aiService.generateJSON([
    { role: 'system', content: `You are a strict RAG evaluator. Given a question, the retrieved evidence chunks, and a model answer, score each metric 0-1.
Return JSON: {"precision":number,"recall":number,"context_relevance":number,"answer_faithfulness":number,"citation_correctness":number,"hallucination_rate":number,"notes":"string"}` },
    { role: 'user', content: `Question: ${question}\n\nRETRIEVED CHUNKS:\n${top.map((t, i) => `[S${i + 1}] (score ${t.score.toFixed(2)}) ${t.text.slice(0, 600)}`).join('\n\n')}\n\nMODEL ANSWER:\n${answer}` },
  ], { temperature: 0.1 });

  const j = judge.json || {};
  return {
    question, answer, latencyMs,
    precision: sanitize(j.precision),
    recall: sanitize(j.recall),
    contextRelevance: sanitize(j.context_relevance),
    answerFaithfulness: sanitize(j.answer_faithfulness),
    citationCorrectness: sanitize(j.citation_correctness),
    hallucinationRate: sanitize(j.hallucination_rate),
    topChunks: top.map(t => ({ source: t.source, page: t.page, score: t.score })),
    notes: j.notes || '',
  };
}

function sanitize(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

// Deterministic-ish metric: naive precision = mean similarity of retrieved chunks
function naivePrecision(score) { return Math.max(0, Math.min(1, score)); }

export async function runEvaluation({ questions, userId, kbId, fileId }) {
  const results = [];
  for (const question of questions) {
    results.push(await evaluateSingle({ question, userId, kbId, fileId }));
  }
  const avg = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
  const summary = {
    precision: avg(results.map(r => r.precision)),
    recall: avg(results.map(r => r.recall)),
    contextRelevance: avg(results.map(r => r.contextRelevance)),
    answerFaithfulness: avg(results.map(r => r.answerFaithfulness)),
    citationCorrectness: avg(results.map(r => r.citationCorrectness)),
    hallucinationRate: avg(results.map(r => r.hallucinationRate)),
    avgLatencyMs: Math.round(avg(results.map(r => r.latencyMs))),
  };
  return { results, summary };
}
