import pool from '../db.js';
import * as aiService from './ai.service.js';

const SYSTEM = `You are InsightRAG's document comparison engine. Compare ONLY the provided document content. Do not use outside knowledge. Never fabricate findings, dates, or contradictions. If a document does not cover a dimension, say it is not covered rather than guessing. Respond in markdown.`;

export async function compareDocuments({ documents, userId, question }) {
  // documents: array of { id, file_name }
  const loaded = [];
  for (const doc of documents) {
    const chunks = await pool.query(
      `SELECT text, page, section FROM document_chunks
        WHERE document_id=$1 AND user_id=$2 ORDER BY chunk_index ASC LIMIT 300`,
      [doc.id, userId]
    );
    let text = chunks.rows.map(r => r.text).join('\n');
    text = text.slice(0, 30000);
    loaded.push({ file_name: doc.file_name, id: doc.id, text, chunks: chunks.rows.length });
  }

  const docsText = loaded.map((d, i) =>
    `===== DOCUMENT ${i + 1}: ${d.file_name} (${d.chunks} chunks) =====\n${d.text}\n===== END ${d.file_name} =====`
  ).join('\n\n');

  const focus = question && question.trim() ? `\nFocus the comparison on: ${question.trim()}` : '';

  const prompt = `Compare the following ${loaded.length} documents.
Produce a structured comparison covering:
- **Similarities** (bulleted)
- **Differences** (bulleted)
- **Key Findings** (bulleted)
- **Contradictions** (bulleted; clearly identify which document each side of the contradiction comes from, or state "None found")
- **Advantages** (per document)
- **Disadvantages** (per document)
- **Missing Information** (what each document does not cover)

Then produce a markdown comparison table with rows = the above dimensions and columns = each document.${focus}

Documents:
${docsText}`;

  const res = await aiService.generateText(prompt, { temperature: 0.3 });
  if (!res) return { success: false, code: 'AI_UNAVAILABLE', message: 'AI service unavailable for comparison.' };

  return {
    success: true,
    comparison: res.trim(),
    documents: loaded.map(d => ({ id: d.id, file_name: d.file_name })),
  };
}
