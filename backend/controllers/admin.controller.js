import pool from '../db.js';
import logger from '../utils/logger.js';

const LOG = 'AdminController';

export async function getStats(req, res) {
  try {
    const [users, docs, convs, msgs, visits, todayVisits, uniqueVisitors] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM documents'),
      pool.query('SELECT COUNT(*) as count FROM conversations'),
      pool.query("SELECT COUNT(*) as count FROM chat_messages WHERE role = 'user'"),
      pool.query('SELECT COUNT(*) as count FROM page_visits'),
      pool.query("SELECT COUNT(*) as count FROM page_visits WHERE created_at >= CURRENT_DATE"),
      pool.query("SELECT COUNT(DISTINCT COALESCE(user_id::text, ip_address)) as count FROM page_visits"),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalDocuments: parseInt(docs.rows[0].count),
      totalConversations: parseInt(convs.rows[0].count),
      totalQuestions: parseInt(msgs.rows[0].count),
      totalVisits: parseInt(visits.rows[0].count),
      todayVisits: parseInt(todayVisits.rows[0].count),
      uniqueVisitors: parseInt(uniqueVisitors.rows[0].count),
    });
  } catch (error) {
    logger.error(LOG, 'Stats error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
}

export async function getUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.role, u.auth_provider,
              u.email_verified, u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM documents WHERE user_id = u.id) as doc_count,
              (SELECT COUNT(*) FROM conversations WHERE user_id = u.id) as conv_count,
              (SELECT COUNT(*) FROM chat_messages WHERE user_id = u.id AND role = 'user') as question_count
       FROM users u ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(LOG, 'Users error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
}

export async function getVisits(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const result = await pool.query(
      `SELECT pv.id, pv.email, pv.page, pv.ip_address, pv.user_agent, pv.created_at, u.full_name
       FROM page_visits pv LEFT JOIN users u ON pv.user_id = u.id
       ORDER BY pv.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(LOG, 'Visits error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch visits' });
  }
}

export async function getVisitStats(req, res) {
  try {
    const result = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as visits
       FROM page_visits WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(created_at) ORDER BY date ASC`
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(LOG, 'Visit stats error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch visit stats' });
  }
}

export async function updateRole(req, res) {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role',
      [role, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'Role update error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
}

export async function runMigration(req, res) {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        email VARCHAR(255), page VARCHAR(500) NOT NULL,
        ip_address VARCHAR(45), user_agent TEXT, referrer TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_visits_user_id ON page_visits(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON page_visits(created_at)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        login_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        logout_at TIMESTAMPTZ, ip_address VARCHAR(45), user_agent TEXT
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
    res.json({ message: 'Migration completed' });
  } catch (err) {
    logger.error(LOG, 'Migration error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}
