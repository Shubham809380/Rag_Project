import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { clearAuthCookie } from '../middleware/auth.middleware.js';
import logger from '../utils/logger.js';

const router = Router();

const LOG = 'UserRoutes';

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, avatar_url, auth_provider, created_at, last_login_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'Get profile error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    const result = await pool.query(
      `UPDATE users SET full_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, full_name, email, avatar_url`,
      [full_name.trim(), req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'Update profile error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [docs, conversations, messages] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM documents WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*) as count FROM conversations WHERE user_id = $1', [req.user.id]),
      pool.query("SELECT COUNT(*) as count FROM chat_messages WHERE user_id = $1 AND role = 'user'", [req.user.id]),
    ]);
    res.json({
      documents: parseInt(docs.rows[0].count),
      conversations: parseInt(conversations.rows[0].count),
      questionsAsked: parseInt(messages.rows[0].count),
    });
  } catch (error) {
    logger.error(LOG, 'Get stats error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

router.delete('/account', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    clearAuthCookie(res);
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    logger.error(LOG, 'Delete account error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
});

export default router;
