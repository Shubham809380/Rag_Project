import pool from '../db.js';
import * as aiService from './ai.service.js';

const TYPE_SPECS = {
  quick: { label: 'Quick Summary', prompt: 'Write a concise quick summary (5-8 sentences) of the document content below.' },
  detailed: { label: 'Detailed Summary', prompt: 'Write a detailed, thorough summary of the document content below, covering all major sections, arguments, and details.' },
  executive: { label: 'Executive Summary', prompt: 'Write an executive summary for business/leadership readers. Highlight purpose, key findings, recommendations, and next steps.' },
  keypoints: { label: 'Key Points', prompt: 'List the most important key points as a bulleted markdown list.' },
  definitions: { label: 'Important Definitions', prompt: 'Extract the most important definitions and terms as a bulleted list with brief explanations.' },
  dates: { label: 'Important Dates', prompt: 'Extract all important dates, deadlines, and timeline events as a markdown list.' },
  actions: { label: 'Action Items', prompt: 'Extract all action items, tasks, recommendations, and next steps as a markdown checklist.' },
};

const SYSTEM = `You are InsightRAG's summarization engine. You summarize ONLY the provided document content. Do not add outside knowledge. Do not invent facts. If asked for items (definitions/dates/actions) that are not present, say so explicitly rather than fabricating. Respond in the same language as the user/dev setting (default English).`;

export function getSummaryTypes() {
  return Object.entries(TYPE_SPECS).map(([id, s]) => ({ id, label: s.label }));
}

export async function generateDocumentSummary({ document, userId, type = 'quick' }) {
  const spec = TYPE_SPECS[type] || TYPE_SPECS.quick;
  const chunks = await pool.query(
    `SELECT text, page, section FROM document_chunks
      WHERE document_id=$1 AND user_id=$2 ORDER BY chunk_index ASC LIMIT 400`,
    [document.id, userId]
  );
  if (chunks.rows.length === 0) {
    return { success: false, code: 'NO_CHUNKS', message: 'No processed content available to summarize.' };
  }
  const maxLen = Math.min(60000, document.pages ? 60000 : 60000);
  let fullText = '';
  const parts = chunks.rows.map((r, i) => `[Chunk ${i + 1}${r.section ? ' | Section: ' + r.section : ''}${r.page ? ' | Page ' + r.page : ''}]\n${r.text}`);
  for (const p of parts) {
    if ((fullText + p).length > maxLen) break;
    fullText += p + '\n\n';
  }

  const prompt = `${spec.prompt}\n\n--- DOCUMENT: ${document.file_name} (${chunks.rows.length} chunks) ---\n\n${fullText}`;
  const res = await aiService.generateText(prompt, { temperature: 0.3 });
  if (!res) return { success: false, code: 'AI_UNAVAILABLE', message: 'AI service unavailable for summarization.' };

  const saved = await pool.query(
    `INSERT INTO summaries (user_id, document_id, type, content) VALUES ($1,$2,$3,$4)
     ON CONFLICT DO NOTHING RETURNING id`,
    [userId, document.id, type, res.trim()]
  ).catch(() => ({ rows: [] }));

  return { success: true, type, content: res.trim(), summaryId: saved.rows?.[0]?.id || null, chunkCount: chunks.rows.length };
}

// Summarize a set of chunks (used by multi-doc summary and study notes)
export async function summarizeChunks(chunks, { instruction = 'Provide a clear summary.', fileName = 'document' } = {}) {
  const parts = chunks.map((c, i) => `[Chunk ${i + 1} | Source: ${c.metadata?.source}${c.metadata?.page ? ' | Page ' + c.metadata.page : ''}]\n${c.metadata?.pageContent || c.text}`);
  const fullText = parts.join('\n\n').slice(0, 50000);
  const prompt = `${instruction}\n\n--- CONTENT ---\n\n${fullText}`;
  return aiService.generateText(prompt, { temperature: 0.3 });
}
