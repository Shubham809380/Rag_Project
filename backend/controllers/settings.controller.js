import pool from '../db.js';
import config from '../config/index.js';

const ALLOWED = {
  model: v => typeof v === 'string' && v.length < 100,
  temperature: v => v >= 0 && v <= 1,
  response_length: v => ['short', 'balanced', 'detailed'].includes(v),
  retrieval_depth: v => v >= 1 && v <= 20,
  rag_mode: v => ['vector', 'keyword', 'hybrid'].includes(v),
  agent_mode: v => typeof v === 'boolean',
  web_research: v => typeof v === 'boolean',
  language: v => config.i18n.languages.includes(v),
  voice_enabled: v => typeof v === 'boolean',
};

export async function getSettings(req, res) {
  try {
    const result = await pool.query(
      `SELECT model, temperature, response_length, retrieval_depth, rag_mode,
              agent_mode, web_research, language, voice_enabled
       FROM user_settings WHERE user_id=$1`, [req.user.id]
    );
    const row = result.rows[0];
    res.json({ success: true, settings: row || { ...config.defaults } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
}

export async function updateSettings(req, res) {
  try {
    const updates = req.body || {};
    const keys = Object.keys(updates);
    const valid = Object.keys(ALLOWED);
    const bad = keys.filter(k => !valid.includes(k) || !ALLOWED[k](updates[k]));
    if (bad.length) {
      return res.status(400).json({ success: false, message: `Invalid settings: ${bad.join(', ')}` });
    }
    if (keys.length === 0) return res.json({ success: true, settings: await getSettingsRow(req.user.id) });

    const setClause = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
    await pool.query(
      `INSERT INTO user_settings (user_id, ${keys.join(',')})
       VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(',')})
       ON CONFLICT (user_id) DO UPDATE SET
         ${setClause},
         updated_at=CURRENT_TIMESTAMP`,
      [req.user.id, ...keys.map(k => updates[k])]
    );
    const settings = await getSettingsRow(req.user.id);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
}

async function getSettingsRow(userId) {
  const r = await pool.query(`SELECT model, temperature, response_length, retrieval_depth, rag_mode,
              agent_mode, web_research, language, voice_enabled FROM user_settings WHERE user_id=$1`, [userId]);
  return r.rows[0] || { ...config.defaults };
}
