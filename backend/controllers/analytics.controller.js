import pool from '../db.js';
import * as usageService from '../services/usage.service.js';
import logger from '../utils/logger.js';

const LOG = 'AnalyticsController';

export async function getUserAnalytics(req, res) {
  try {
    const data = await usageService.getUserAnalytics(req.user.id);
    const searchStats = await usageService.getSearchStatistics(req.user.id);
    res.json({ success: true, ...data, searchStats });
  } catch (err) {
    logger.error(LOG, 'analytics failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to load analytics' });
  }
}

// Detailed session / page analytics (beyond the aggregate dashboard)
export async function getSessionAnalytics(req, res) {
  try {
    const sessions = await pool.query(
      `SELECT id, session_id, started_at, ended_at, duration_seconds, pages_count
         FROM user_sessions WHERE user_id=$1 ORDER BY started_at DESC LIMIT 50`,
      [req.user.id]
    );
    const pageVisits = await pool.query(
      `SELECT path, COUNT(*) AS visits FROM page_visits
         WHERE user_id=$1 GROUP BY path ORDER BY visits DESC`,
      [req.user.id]
    );
    res.json({ success: true, sessions: sessions.rows, pageVisits: pageVisits.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load session analytics' });
  }
}
