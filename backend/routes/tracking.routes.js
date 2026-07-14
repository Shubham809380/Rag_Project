import { Router } from 'express';
import pool from '../db.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/track-visit', optionalAuth, async (req, res) => {
  try {
    const { page } = req.body;
    if (!page) return res.json({ ok: true });
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';
    const userId = req.user?.id || null;
    const email = req.user?.email || null;
    await pool.query(
      'INSERT INTO page_visits (user_id, email, page, ip_address, user_agent, referrer) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, email, page, ip, ua, referrer]
    );
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

export default router;
