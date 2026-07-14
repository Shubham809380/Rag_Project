import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import pool from '../db.js';

export function authenticateToken(req, res, next) {
  const token = req.cookies[config.auth.cookieName] || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
}

export function optionalAuth(req, res, next) {
  const token = req.cookies[config.auth.cookieName] || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      req.user = jwt.verify(token, config.auth.jwtSecret);
    } catch {}
  }
  next();
}

export async function isAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.full_name },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

export function setAuthCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  res.cookie(config.auth.cookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    maxAge,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.cookie(config.auth.cookieName, '', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
}
