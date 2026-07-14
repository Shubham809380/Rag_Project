import bcrypt from 'bcrypt';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from '../db.js';
import config from '../config/index.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.middleware.js';
import logger from '../utils/logger.js';

const LOG = 'AuthController';

export function configurePassport() {
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  if (!config.auth.googleClientId || !config.auth.googleClientSecret) {
    logger.warn(LOG, 'Google OAuth disabled - missing credentials');
    return;
  }

  passport.use('google', new GoogleStrategy({
    clientID: config.auth.googleClientId,
    clientSecret: config.auth.googleClientSecret,
    callbackURL: config.auth.callbackUrl,
    scope: ['profile', 'email'],
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value?.toLowerCase();
      const fullName = profile.displayName;
      const avatarUrl = profile.photos?.[0]?.value || null;
      const emailVerified = profile.emails?.[0]?.verified || false;

      if (!email) return done(new Error('No email from Google'), null);

      const isAdminUser = email === config.auth.adminEmail;
      let result;
      try {
        result = await pool.query(
          `INSERT INTO users (google_id, full_name, email, avatar_url, email_verified, auth_provider, role, last_login_at)
           VALUES ($1, $2, $3, $4, $5, 'google', $6, CURRENT_TIMESTAMP)
           ON CONFLICT (google_id) DO UPDATE SET
             full_name = EXCLUDED.full_name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url,
             email_verified = EXCLUDED.email_verified, auth_provider = 'google',
             role = CASE WHEN $7 THEN 'admin' ELSE users.role END,
             updated_at = CURRENT_TIMESTAMP, last_login_at = CURRENT_TIMESTAMP
           RETURNING id, google_id, full_name, email, avatar_url, role`,
          [googleId, fullName, email, avatarUrl, emailVerified, isAdminUser ? 'admin' : 'user', isAdminUser]
        );
      } catch {
        result = await pool.query(
          `INSERT INTO users (google_id, full_name, email, avatar_url, email_verified, auth_provider, last_login_at)
           VALUES ($1, $2, $3, $4, $5, 'google', CURRENT_TIMESTAMP)
           ON CONFLICT (google_id) DO UPDATE SET
             full_name = EXCLUDED.full_name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url,
             email_verified = EXCLUDED.email_verified, auth_provider = 'google',
             updated_at = CURRENT_TIMESTAMP, last_login_at = CURRENT_TIMESTAMP
           RETURNING id, google_id, full_name, email, avatar_url`,
          [googleId, fullName, email, avatarUrl, emailVerified]
        );
        if (result.rows[0]) result.rows[0].role = isAdminUser ? 'admin' : 'user';
      }
      return done(null, result.rows[0]);
    } catch (error) {
      logger.error(LOG, 'Google OAuth error', { error: error.message });
      return done(error, null);
    }
  }));

  logger.info(LOG, 'Google OAuth configured');
}

export function getGoogleAuthUrl(redirectPath) {
  const backendUrl = config.auth.backendUrl;
  const redirectUrl = new URL(redirectPath || '/dashboard', config.auth.frontendUrl).toString();
  return `${backendUrl}/api/auth/google?redirect=${encodeURIComponent(redirectUrl)}`;
}

function getSafeRedirectUrl(rawRedirect) {
  const fallback = `${config.auth.frontendUrl}/dashboard`;
  if (!rawRedirect) return fallback;
  try {
    const parsed = new URL(rawRedirect, config.auth.frontendUrl);
    const expectedOrigin = new URL(config.auth.frontendUrl).origin;
    if (parsed.origin !== expectedOrigin) return fallback;
    return parsed.toString();
  } catch { return fallback; }
}

export function googleAuth(req, res, next) {
  if (!config.auth.googleClientId || !config.auth.googleClientSecret) {
    return res.status(503).json({ success: false, message: 'Google OAuth not configured' });
  }
  const redirectUrl = getSafeRedirectUrl(req.query.redirect);
  passport.authenticate('google', {
    scope: ['profile', 'email'], prompt: 'select_account', session: false, state: redirectUrl,
  })(req, res, next);
}

export function googleCallback(req, res, next) {
  if (req.query.error) {
    return res.redirect(`${config.auth.frontendUrl}/login?error=${encodeURIComponent(req.query.error)}`);
  }
  passport.authenticate('google', { session: false }, (error, user) => {
    if (error || !user) {
      return res.redirect(`${config.auth.frontendUrl}/login?error=google_auth_failed`);
    }
    try {
      const token = generateToken(user);
      setAuthCookie(res, token);
      pool.query(
        `INSERT INTO user_sessions (user_id, ip_address, user_agent) VALUES ($1, $2, $3)`,
        [user.id, req.headers['x-forwarded-for'] || req.socket.remoteAddress || null, req.headers['user-agent'] || null]
      ).catch(() => {});
      return res.redirect(getSafeRedirectUrl(req.query.state));
    } catch (err) {
      return res.redirect(`${config.auth.frontendUrl}/login?error=auth_failed`);
    }
  })(req, res, next);
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const isAdminEmail = email.toLowerCase() === config.auth.adminEmail;
    let result;
    try {
      result = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, auth_provider, email_verified, role, last_login_at)
         VALUES ($1, $2, $3, 'email', false, $4, CURRENT_TIMESTAMP)
         RETURNING id, full_name, email, avatar_url, role, created_at`,
        [name.trim(), email.toLowerCase(), passwordHash, isAdminEmail ? 'admin' : 'user']
      );
    } catch {
      result = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, auth_provider, email_verified, last_login_at)
         VALUES ($1, $2, $3, 'email', false, CURRENT_TIMESTAMP)
         RETURNING id, full_name, email, avatar_url, created_at`,
        [name.trim(), email.toLowerCase(), passwordHash]
      );
      if (result.rows[0]) result.rows[0].role = isAdminEmail ? 'admin' : 'user';
    }

    const user = result.rows[0];
    const token = generateToken(user);
    setAuthCookie(res, token);
    logger.info(LOG, 'User registered', { userId: user.id, email: user.email });
    res.status(201).json({ user });
  } catch (error) {
    logger.error(LOG, 'Register error', { error: error.message });
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    let result;
    try {
      result = await pool.query(
        'SELECT id, full_name, email, avatar_url, password_hash, role, created_at FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
    } catch {
      result = await pool.query(
        'SELECT id, full_name, email, avatar_url, password_hash, created_at FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      if (result.rows[0]) result.rows[0].role = 'user';
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ success: false, message: 'This account uses Google sign-in. Please use "Continue with Google".' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    const token = generateToken(user);
    setAuthCookie(res, token);

    const { password_hash, ...safeUser } = user;
    logger.info(LOG, 'User logged in', { userId: user.id });
    res.json({ user: safeUser });
  } catch (error) {
    logger.error(LOG, 'Login error', { error: error.message });
    res.status(500).json({ success: false, message: 'Login failed' });
  }
}

export async function getMe(req, res) {
  try {
    let result;
    try {
      result = await pool.query(
        'SELECT id, full_name, email, avatar_url, role, auth_provider, created_at FROM users WHERE id = $1',
        [req.user.id]
      );
    } catch {
      result = await pool.query(
        'SELECT id, full_name, email, avatar_url, created_at FROM users WHERE id = $1',
        [req.user.id]
      );
      if (result.rows[0]) { result.rows[0].role = 'user'; result.rows[0].auth_provider = 'email'; }
    }

    if (result.rows.length === 0) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];
    if (user.email?.toLowerCase() === config.auth.adminEmail && user.role !== 'admin') {
      try { await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]); } catch {}
      user.role = 'admin';
    }

    res.json({ user });
  } catch (error) {
    logger.error(LOG, 'GetMe error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get user data' });
  }
}

export async function logout(req, res) {
  clearAuthCookie(res);
  if (req.user?.id) {
    try {
      await pool.query(`UPDATE user_sessions SET logout_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND logout_at IS NULL`, [req.user.id]);
    } catch {}
  }
  res.json({ message: 'Logged out successfully' });
}
