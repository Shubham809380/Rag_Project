import pool from '../db.js';
import * as aiService from '../services/ai.service.js';
import * as researchService from '../services/research.service.js';
import * as agentService from '../services/agent.service.js';
import * as summaryService from '../services/summary.service.js';
import * as compareService from '../services/compare.service.js';
import * as studyService from '../services/study.service.js';
import * as voiceService from '../services/voice.service.js';
import * as exportService from '../services/export.service.js';
import { logUsage } from '../services/usage.service.js';
import logger from '../utils/logger.js';

const LOG = 'AiFeatures';

function normalizeId(v) {
  return v ? String(v).trim() : null;
}

// ---------- SUMMARY ----------
export async function summarize(req, res) {
  try {
    const { type = 'quick' } = req.body;
    const docId = normalizeId(req.body.documentId);
    if (!docId) return res.status(400).json({ success: false, message: 'documentId is required' });
    const doc = await pool.query('SELECT id, file_name, pages FROM documents WHERE id=$1 AND user_id=$2', [docId, req.user.id]);
    if (doc.rows.length === 0) return res.status(404).json({ success: false, message: 'Document not found' });
    const result = await summaryService.generateDocumentSummary({ document: doc.rows[0], userId: req.user.id, type });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    logger.error(LOG, 'summarize failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to summarize document' });
  }
}

export async function listSummaryTypes(_req, res) {
  res.json({ success: true, types: summaryService.getSummaryTypes() });
}

// ---------- RESEARCH ----------
export async function research(req, res) {
  try {
    const { question, mode = 'kb', knowledgeBaseId, fileId, fileIds } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ success: false, message: 'Question is required for research mode' });
    const result = await researchService.runResearch({
      question: question.trim(),
      userId: req.user.id,
      kbId: normalizeId(knowledgeBaseId),
      fileId: normalizeId(fileId),
      fileIds: Array.isArray(fileIds) ? fileIds.map(normalizeId).filter(Boolean) : undefined,
      mode,
    });
    if (!result.success) return res.status(400).json(result);
    logUsage({ userId: req.user.id, type: 'research', query: question, latencyMs: result.durationMs, success: true });
    res.json(result);
  } catch (err) {
    logger.error(LOG, 'research failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to run research: ' + err.message });
  }
}

export async function getResearchHistory(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, question, mode, created_at FROM research_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, sessions: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load research history' });
  }
}

export async function getResearch(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, question, mode, report, sources, created_at FROM research_sessions WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Research session not found' });
    const row = result.rows[0];
    try { row.sources = JSON.parse(row.sources); } catch { row.sources = {}; }
    res.json({ success: true, session: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load research session' });
  }
}

export async function deleteResearch(req, res) {
  try {
    await pool.query('DELETE FROM research_sessions WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Research session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete research session' });
  }
}

// ---------- AGENT ----------
export async function agentChat(req, res) {
  try {
    const { question, knowledgeBaseId, fileId, fileIds, settings = {} } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ success: false, message: 'Question is required' });
    const result = await agentService.runAgent({
      question: question.trim(),
      userId: req.user.id,
      kbId: normalizeId(knowledgeBaseId),
      fileId: normalizeId(fileId),
      fileIds: Array.isArray(fileIds) ? fileIds.map(normalizeId).filter(Boolean) : undefined,
      settings,
    });
    if (!result.success) return res.status(400).json(result);
    logUsage({ userId: req.user.id, type: 'agent', query: question, latencyMs: result.durationMs, success: true });
    res.json(result);
  } catch (err) {
    logger.error(LOG, 'agentChat failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to run agent: ' + err.message });
  }
}

// ---------- COMPARE ----------
export async function compare(req, res) {
  try {
    const { documentIds = [], question } = req.body;
    if (documentIds.length < 2) return res.status(400).json({ success: false, message: 'Select at least 2 documents to compare' });
    const docs = await pool.query(
      'SELECT id, file_name FROM documents WHERE id = ANY($1::uuid[]) AND user_id=$2',
      [documentIds, req.user.id]
    );
    if (docs.rows.length < 2) return res.status(404).json({ success: false, message: 'Not enough accessible documents found' });
    const result = await compareService.compareDocuments({ documents: docs.rows, userId: req.user.id, question: question || '' });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    logger.error(LOG, 'compare failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to compare documents: ' + err.message });
  }
}

// ---------- STUDY MODE ----------
export async function study(req, res) {
  try {
    const { documentId, kind = 'mcq', difficulty = 'medium', count = 6 } = req.body;
    const docId = normalizeId(documentId);
    if (!docId) return res.status(400).json({ success: false, message: 'documentId is required' });
    const doc = await pool.query('SELECT id FROM documents WHERE id=$1 AND user_id=$2', [docId, req.user.id]);
    if (doc.rows.length === 0) return res.status(404).json({ success: false, message: 'Document not found' });
    const result = await studyService.getStudyMaterial({ documentId: docId, userId: req.user.id, kind, difficulty, count });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    logger.error(LOG, 'study failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to generate study material: ' + err.message });
  }
}

export async function submitQuiz(req, res) {
  try {
    const { quizId, answers } = req.body;
    const q = await pool.query('SELECT id, questions, user_id FROM quiz_sessions WHERE id=$1 AND user_id=$2', [quizId, req.user.id]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const questions = JSON.parse(q.rows[0].questions);
    let score = 0;
    const results = questions.map((que, i) => {
      const correct = que.answer_index === (answers && answers[i] != null ? answers[i] : -1);
      if (correct) score++;
      return { correct, userAnswer: answers?.[i] ?? null, correctAnswer: que.answer_index, question: que.question };
    });
    const total = questions.length;
    const pct = total ? Math.round((score / total) * 100) : 0;
    await pool.query(`UPDATE quiz_sessions SET answers=$2, score=$3, completed_at=NOW() WHERE id=$1`,
      [quizId, JSON.stringify(results), score]).catch(() => {});
    res.json({ success: true, score, total, percent: pct, results });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit quiz' });
  }
}

export async function getQuizResults(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, subject, difficulty, score, total, completed_at, questions, answers
       FROM quiz_sessions WHERE user_id=$1 AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ success: true, quizzes: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load quiz results' });
  }
}

// ---------- VOICE ----------
export async function voiceCapabilities(_req, res) {
  res.json({ success: true, capabilities: voiceService.getVoiceCapabilities() });
}

export async function transcribe(req, res) {
  try {
    const audio = req.file;
    if (!audio) return res.status(400).json({ success: false, message: 'No audio file provided' });
    const { mime = 'audio/webm', language } = req.body;
    const result = await voiceService.transcribeAudio(audio.buffer, { mime, language });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to transcribe audio: ' + err.message });
  }
}

export async function synthesize(req, res) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });
    const result = await voiceService.synthesizeSpeech(text);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to synthesize speech: ' + err.message });
  }
}

// ---------- EXPORT ----------
export async function exportContent(req, res) {
  try {
    const { format = 'markdown', title, content, meta = {}, contentType = 'application/octet-stream' } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'content is required' });
    const result = await exportService.exportDocument({ format, title: title || 'InsightRAG Export', content, meta });
    const ext = result.format === 'pdf' ? 'pdf' : result.format === 'txt' ? 'txt' : 'md';
    const safeBase = (title || 'export').replace(/[^a-z0-9-_]/gi, '_').slice(0, 60);
    res.setHeader('Content-Type', result.format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeBase}.${ext}"`);
    res.send(result.buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to export content: ' + err.message });
  }
}

// ---------- FEEDBACK (message rating) ----------
export async function rateMessage(req, res) {
  try {
    const { messageId, rating } = req.body;
    if (!messageId) return res.status(400).json({ success: false, message: 'messageId is required' });
    if (rating !== 'like' && rating !== 'dislike') return res.status(400).json({ success: false, message: 'rating must be like or dislike' });
    const upd = await pool.query(
      'UPDATE chat_messages SET rating=$3, rating_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id',
      [messageId, req.user.id, rating]
    );
    if (upd.rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, message: 'Feedback saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save feedback' });
  }
}

export async function clearRating(req, res) {
  try {
    await pool.query('UPDATE chat_messages SET rating=NULL, rating_at=NULL WHERE id=$1 AND user_id=$2',
      [req.body.messageId, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to clear feedback' });
  }
}

// ---------- AI MODELS ----------
export async function availableModels(_req, res) {
  res.json({ success: true, models: aiService.getAvailableModels() });
}
