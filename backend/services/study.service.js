import pool from '../db.js';
import * as aiService from './ai.service.js';

const SYSTEM = `You are InsightRAG's Study Mode engine. Generate study content ONLY from the provided document content. Do not add outside knowledge. Questions must be answerable from the given content. Respond in the requested JSON structure. Do not fabricate facts.`;

function getDifficultySeed(difficulty) {
  return difficulty === 'easy' ? 'Make questions basic and factual.' :
    difficulty === 'hard' ? 'Make questions advanced, analytical, and challenging.' :
    'Make questions moderate and balanced.';
}

export async function getStudyMaterial({ documentId, userId, kind, difficulty = 'medium', count = 6 }) {
  const chunks = await pool.query(
    `SELECT text, section, page FROM document_chunks
      WHERE document_id=$1 AND user_id=$2 ORDER BY chunk_index ASC LIMIT 400`,
    [documentId, userId]
  );
  if (chunks.rows.length === 0) {
    return { success: false, code: 'NO_CONTENT', message: 'No processed document content available for study mode.' };
  }
  const text = chunks.rows.map(r => `[${r.section ? r.section + ' | ' : ''}${r.page ? 'p.' + r.page + ' ' : ''}]${r.text}`)
    .join('\n\n').slice(0, 60000);

  let prompt;
  let jsonKey;
  const seed = getDifficultySeed(difficulty);

  if (kind === 'mcq') {
    jsonKey = 'questions';
    prompt = `Generate ${count} multiple-choice questions. ${seed} Respond JSON: {"questions":[{"question":"...","options":["A...","B...","C...","D..."],"answer_index":0,"explanation":"..."}]}`;
  } else if (kind === 'flashcards') {
    jsonKey = 'flashcards';
    prompt = `Generate ${count} flashcards (term + definition from content). Respond JSON: {"flashcards":[{"front":"...","back":"..."}]}`;
  } else if (kind === 'short_questions') {
    jsonKey = 'questions';
    prompt = `Generate ${count} short-answer questions. ${seed} Respond JSON: {"questions":[{"question":"...","answer":"..."}]}`;
  } else if (kind === 'long_questions') {
    jsonKey = 'questions';
    prompt = `Generate ${count} long-answer/essay questions. ${seed} Respond JSON: {"questions":[{"question":"...","points":["point1","point2"]}]}`;
  } else if (kind === 'viva') {
    jsonKey = 'questions';
    prompt = `Generate ${count} viva/oral exam questions with model answers. ${seed} Respond JSON: {"questions":[{"question":"...","answer":"..."}]}`;
  } else if (kind === 'important_topics') {
    jsonKey = 'topics';
    prompt = `List the ${count} most important topics/themes in this content with a one-line explanation each. Respond JSON: {"topics":[{"topic":"...","explanation":"..."}]}`;
  } else if (kind === 'notes') {
    jsonKey = 'notes';
    prompt = `Generate structured study notes (headings, bullets, key formulas/definitions) from the content. Respond as clean, readable Markdown in the "notes" field.`;
  } else {
    jsonKey = 'summary';
    prompt = `Provide a chapter summary of the content in %d paragraphs.`;
  }

  // Notes & chapter summary return markdown string, others return JSON
  const isMarkdown = kind === 'notes' || kind === 'summary';
  if (kind === 'summary') {
    jsonKey = 'summary';
    prompt = 'Provide a clear chapter summary of the content below in 3-4 paragraphs followed by 5-8 key bullet points.';
  }

  const res = await aiService.generate(isMarkdown
    ? [{ role: 'system', content: SYSTEM }, { role: 'user', content: `${prompt}\n\nCONTENT:\n${text}` }]
    : [{ role: 'system', content: SYSTEM }, { role: 'user', content: `${prompt}\n\nCONTENT:\n${text}` }],
    { temperature: 0.4 });

  if (!res) return { success: false, code: 'AI_UNAVAILABLE', message: 'AI service unavailable for study mode.' };

  let content = null;
  let parsed = null;
  if (isMarkdown) {
    content = { markdown: res.content.trim() };
  } else {
    try {
      const fenced = res.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const target = fenced ? fenced[1] : res.content;
      const start = target.indexOf('{');
      const end = target.lastIndexOf('}');
      parsed = JSON.parse(target.slice(start, end + 1));
      content = parsed[jsonKey] || parsed;
    } catch {
      content = { raw: res.content.trim() };
    }
  }

  // Persist quiz session for MCQ
  let quizId = null;
  if (kind === 'mcq' && content?.questions) {
    const saved = await pool.query(
      `INSERT INTO quiz_sessions (user_id, subject, difficulty, questions, answers, total)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, 'study', difficulty, JSON.stringify(content.questions), JSON.stringify([]), content.questions.length]
    ).catch(() => ({ rows: [{ id: null }] }));
    quizId = saved.rows[0]?.id || null;
  }

  return { success: true, kind, content, count: (content?.length || content?.questions?.length || 1), quizId };
}
