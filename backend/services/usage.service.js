import pool from '../db.js';

// Centralized usage/analytics logging. Fire-and-forget; never blocks a request.
export function logUsage({
  userId, type, query, documentIds, latencyMs, chunksRetrieved,
  confidence, model, tokensUsed, success = true, errorCode, metadata,
}) {
  try {
    pool.query(
      `INSERT INTO usage_logs
        (user_id, type, query, document_ids, latency_ms, chunks_retrieved, confidence, model, tokens_used, success, error_code, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [userId || null, type, query || null, documentIds ? JSON.stringify(documentIds) : null,
        latencyMs || 0, chunksRetrieved || 0, confidence || null, model || null,
        tokensUsed || 0, success, errorCode || null, metadata ? JSON.stringify(metadata) : null]
    ).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Aggregate analytics for a single user (dashboard + analytics page)
export async function getUserAnalytics(userId) {
  const [totals, docs, mostUsed, recentActivity, latency, confidence, daily] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE type='chat' OR type='agent') AS questions,
         COUNT(*) FILTER (WHERE type='retrieval') AS retrievals,
         COUNT(*) FILTER (WHERE success = TRUE AND (type='chat' OR type='agent')) AS successful,
         COUNT(*) FILTER (WHERE success = FALSE) AS failed,
         COALESCE(AVG(latency_ms) FILTER (WHERE latency_ms>0),0)::int AS avg_latency,
         COALESCE(SUM(tokens_used),0) AS tokens
       FROM usage_logs WHERE user_id=$1`, [userId]),
    pool.query(
      `SELECT file_name, COUNT(*) AS uses FROM usage_logs ul
         JOIN documents d ON d.id = ANY(COALESCE(ul.document_ids::uuid[], '{}'::uuid[]))
        WHERE ul.user_id=$1 GROUP BY d.id, file_name ORDER BY uses DESC LIMIT 5`, [userId]),
    pool.query(
      `SELECT DISTINCT ON (file_name) file_name, chunk_count
         FROM documents WHERE user_id=$1`, [userId]),
    pool.query(
      `SELECT type, query, latency_ms, success, created_at FROM usage_logs
        WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, [userId]),
    pool.query(
      `SELECT COALESCE(AVG(latency_ms) FILTER (WHERE latency_ms>0 AND (type='chat' OR type='agent')),0)::int AS avg_response,
              COUNT(*) FILTER (WHERE type='chat' OR type='agent') AS questions
         FROM usage_logs WHERE user_id=$1`, [userId]),
    pool.query(
      `SELECT confidence, COUNT(*) AS cnt FROM usage_logs
        WHERE user_id=$1 AND confidence IS NOT NULL GROUP BY confidence`, [userId]),
    pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM usage_logs
        WHERE user_id=$1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY date ASC`, [userId]),
  ]);

  return {
    totals: totals.rows[0] || {},
    mostUsedDocuments: docs.rows,
    documents: docs.rows.length,
    recentActivity: recentActivity.rows,
    avgResponseTime: latency.rows[0]?.avg_response || 0,
    questions: latency.rows[0]?.questions || 0,
    confidence: confidence.rows,
    daily: daily.rows,
  };
}

// Search statistics / most searched topics
export async function getSearchStatistics(userId) {
  const result = await pool.query(
    `SELECT query, COUNT(*) AS count FROM usage_logs
      WHERE user_id=$1 AND query IS NOT NULL GROUP BY query
      ORDER BY count DESC LIMIT 20`, [userId]
  );
  return result.rows;
}
