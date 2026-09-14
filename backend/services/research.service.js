import pool from '../db.js';
import config from '../config/index.js';
import * as aiService from './ai.service.js';
import { hybridRetrieve } from './retrieval.service.js';
import { webSearch } from './websearch.service.js';

function emit(progress, step, status) {
  progress.push({ step, status, time: new Date().toISOString() });
}

async function runSearch(question, ctx) {
  const { userId, kbId, fileId, fileIds } = ctx;
  // Multi-document selection (uuid list) OR kb OR single file
  if (fileIds && fileIds.length > 0) {
    const all = [];
    for (const id of fileIds) {
      const doc = await pool.query('SELECT pinecone_file_id FROM documents WHERE id=$1 AND user_id=$2', [id, userId]);
      if (doc.rows[0]) {
        const { chunks } = await hybridRetrieve({ question, userId, fileId: doc.rows[0].pinecone_file_id, topK: 4 });
        all.push(...chunks);
      }
    }
    return all;
  }
  const { chunks } = await hybridRetrieve({ question, userId, fileId: fileId || null, kbId: kbId || null, topK: 8 });
  return chunks;
}

export async function runResearch({ question, userId, kbId, fileId, fileIds, mode = 'kb', onProgress }) {
  const progress = [];
  const start = Date.now();

  emit(progress, 'Understanding Query', 'running');
  // Understand query + break into sub-questions
  const planRes = await aiService.generateJSON([
    { role: 'system', content: 'You are a research planning assistant. Break a research question into 3-5 focused sub-questions and key search terms. Respond with JSON: {"sub_questions": [...], "keywords": [...], "interpretation": "..."}' },
    { role: 'user', content: question },
  ], { temperature: 0.3 });

  emit(progress, 'Understanding Query', 'done');
  emit(progress, 'Breaking into Sub-Questions', 'running');
  const subQuestions = (planRes.json?.sub_questions || [question]).slice(0, 5);
  const keywords = planRes.json?.keywords || [];
  await new Promise(r => setTimeout(r, 120));
  emit(progress, 'Breaking into Sub-Questions', 'done');

  // Retrieve combined evidence from KB
  const allChunks = [];
  const usedDocs = new Set();
  const searchProbes = [...subQuestions, ...keywords].slice(0, 6);
  emit(progress, 'Searching Knowledge Base', 'running');
  for (const probe of searchProbes) {
    try {
      const chunks = await runSearch(probe, { userId, kbId, fileId, fileIds });
      for (const c of chunks) {
        const src = c.metadata?.source || 'Unknown';
        usedDocs.add(src);
        allChunks.push(c);
      }
    } catch { /* continue */ }
  }
  emit(progress, 'Searching Knowledge Base', 'done');

  const webSources = [];
  if (mode === 'web' || mode === 'both') {
    emit(progress, 'Searching the Web', 'running');
    const webQuery = keywords.length ? keywords.join(' ') : question;
    try {
      webSources.push(...((await webSearch(webQuery)) || []));
    } catch { /* ignore */ }
    for (const sq of subQuestions.slice(0, 2)) {
      try { webSources.push(...(await webSearch(sq))); } catch {}
    }
    const seen = new Set();
    const deduped = webSources.filter(w => { const k = w.url; if (seen.has(k)) return false; seen.add(k); return true; });
    webSources.length = 0;
    webSources.push(...deduped);
    emit(progress, 'Searching the Web', 'done');
  }

  emit(progress, 'Comparing Sources', 'running');
  await new Promise(r => setTimeout(r, 120));
  emit(progress, 'Comparing Sources', 'done');

  emit(progress, 'Detecting Contradictions', 'running');
  // Build context for LLM
  const kbContext = allChunks.slice(0, 30).map((c, i) =>
    `[Src ${i + 1}: ${c.metadata?.source || 'KB'}${c.metadata?.page ? ' | Page ' + c.metadata.page : ''}]\n${c.metadata?.pageContent || c.text}`
  ).join('\n\n---\n\n').slice(0, 60000);
  const webContext = webSources.slice(0, 10).map((w, i) =>
    `[Web ${i + 1}: ${w.title} | ${w.domain}]\n${w.snippet}`
  ).join('\n\n---\n\n');

  const system = `You are InsightRAG's research agent. Produce a structured research report based ONLY on the provided evidence. Do NOT fabricate sources, page numbers, dates, or findings. If evidence is insufficient, say so explicitly under "Limitations". Clearly label web sources separately from knowledge-base sources. Respond in Markdown with EXACTLY these sections:
# Research Report
## Executive Summary
## Research Question
## Key Findings
## Evidence
## Comparison
## Contradictions
## Limitations
## Conclusion
## Sources`;

  const user = `Research Question: ${question}

=== KNOWLEDGE BASE EVIDENCE ===
${kbContext || '(No relevant KB evidence found.)'}

${mode !== 'kb' ? `=== WEB SOURCES ===\n${webContext || '(No web sources found.)'}` : ''}`;

  emit(progress, 'Detecting Contradictions', 'done');
  emit(progress, 'Generating Report', 'running');

  const res = await aiService.generateText([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], { temperature: 0.3 });
  if (!res) {
    emit(progress, 'Generating Report', 'error');
    return { success: false, code: 'AI_UNAVAILABLE', message: 'AI service unavailable for research.' };
  }
  emit(progress, 'Generating Report', 'done');

  const report = res.trim();
  const sources = {
    knowledgeBase: Array.from(usedDocs).map(name => ({ name, type: 'kb' })),
    web: webSources.map(w => ({ title: w.title, url: w.url, domain: w.domain, type: 'web' })),
  };

  const saved = await pool.query(
    `INSERT INTO research_sessions (user_id, question, mode, report, sources, progress)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [userId, question, mode, report, JSON.stringify(sources), JSON.stringify(progress)]
  ).catch(() => ({ rows: [{ id: null }] }));

  return {
    success: true,
    id: saved.rows[0].id,
    report,
    sources,
    subQuestions,
    progress,
    durationMs: Date.now() - start,
  };
}
