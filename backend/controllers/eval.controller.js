import pool from '../db.js';
import config from '../config/index.js';
import * as evalService from '../services/eval.service.js';
import logger from '../utils/logger.js';

const LOG = 'EvalController';

export async function runEval(req, res) {
  try {
    const { questions, questionsBaseType } = req.body;
    const { knowledgeBaseId, fileId } = req.body;
    let qs = questions;
    if (questionsBaseType === 'default') {
      qs = config.evalQuestions;
    }
    if (!Array.isArray(qs) || !qs.length) qs = config.evalQuestions;

    const { results, summary } = await evalService.runEvaluation({
      questions: qs.slice(0, 10),
      userId: req.user.id,
      kbId: knowledgeBaseId || null,
      fileId: fileId || null,
    });

    // Persist aggregate evaluation
    const saved = await pool.query(
      `INSERT INTO rag_evaluations
        (user_id, question, precision, recall, context_relevance, answer_faithfulness, citation_correctness, hallucination_rate, latency_ms, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [req.user.id, qs[0], summary.precision, summary.recall, summary.contextRelevance,
        summary.answerFaithfulness, summary.citationCorrectness, summary.hallucinationRate,
        summary.avgLatencyMs, config.gemini.llmModels[0]]
    ).catch((e) => {
      logger.warn(LOG, 'persist eval failed', { error: e.message });
      return { rows: [{ id: null }] };
    });

    res.json({ success: true, summary, results, evalId: saved.rows[0]?.id || null });
  } catch (err) {
    logger.error(LOG, 'runEval failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to run evaluation: ' + err.message });
  }
}

export async function getEvalHistory(req, res) {
  try {
    // scope=all exposes every user's evaluation rows — an IDOR in the classic
    // domain. Only a server-side admin may see everyone's history; any other
    // role always gets their own rows only.
    const scopeAll = req.params.scope === 'all' && req.user?.role === 'admin';
    const result = await pool.query(
      `SELECT id, question, precision, recall, context_relevance, answer_faithfulness,
              citation_correctness, hallucination_rate, latency_ms, model, created_at
       FROM rag_evaluations
       WHERE ${scopeAll ? 'TRUE' : 'user_id=$1'}
       ORDER BY created_at DESC LIMIT 50`,
      scopeAll ? [] : [req.user.id]
    );
    res.json({ success: true, history: result.rows, scope: scopeAll ? 'all' : 'own' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load evaluation history' });
  }
}
