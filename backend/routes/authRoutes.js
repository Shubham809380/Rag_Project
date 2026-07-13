import express from 'express';
import jwt from 'jsonwebtoken';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

export const COOKIE_NAME = 'auth_token';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function ensureAbsoluteUrl(value, fallback) {
  const candidate = trimTrailingSlash((value || fallback || '').trim());
  try {
    return new URL(candidate).toString().replace(/\/$/, '');
  } catch {
    return trimTrailingSlash(fallback);
  }
}

function authLog(step, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[auth] ${timestamp} ${step}`, details);
}

export function buildAuthConfig(env = process.env) {
  const frontendUrl = ensureAbsoluteUrl(env.FRONTEND_URL, 'http://localhost:5173');
  const backendUrl = ensureAbsoluteUrl(env.BACKEND_URL, 'http://localhost:5000');
  const callbackUrl = ensureAbsoluteUrl(
    env.GOOGLE_CALLBACK_URL,
    `${backendUrl}/api/auth/google/callback`
  );

  return {
    adminEmail: (env.ADMIN_EMAIL || 'patrashubhamm031@gmail.com').toLowerCase(),
    backendUrl,
    callbackUrl,
    cookieName: COOKIE_NAME,
    frontendUrl,
    isProduction: env.NODE_ENV === 'production',
    jwtSecret: env.JWT_SECRET,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

export function createCorsOptions(authConfig) {
  return {
    origin(origin, callback) {
      if (!origin || origin === authConfig.frontendUrl) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin ${origin}`));
    },
    credentials: true,
  };
}

function getCookieOptions(authConfig, maxAge = 7 * 24 * 60 * 60 * 1000) {
  return {
    httpOnly: true,
    secure: authConfig.isProduction,
    sameSite: authConfig.isProduction ? 'none' : 'lax',
    maxAge,
    path: '/',
  };
}

export function setAuthCookie(res, token, authConfig) {
  res.cookie(authConfig.cookieName, token, getCookieOptions(authConfig));
}

export function clearAuthCookie(res, authConfig) {
  res.cookie(authConfig.cookieName, '', getCookieOptions(authConfig, 0));
}

export function getRequestToken(req, authConfig) {
  return req.cookies[authConfig.cookieName] || req.headers.authorization?.replace('Bearer ', '');
}

export function createAuthenticateToken(authConfig) {
  return (req, res, next) => {
    const token = getRequestToken(req, authConfig);
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      req.user = jwt.verify(token, authConfig.jwtSecret);
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }
  };
}

function generateToken(user, authConfig) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.full_name },
    authConfig.jwtSecret,
    { expiresIn: '7d' }
  );
}

function getSafeRedirectUrl(rawRedirect, frontendUrl) {
  const fallbackUrl = `${frontendUrl}/dashboard`;
  if (!rawRedirect) {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(rawRedirect, frontendUrl);
    const expectedOrigin = new URL(frontendUrl).origin;
    if (parsed.origin !== expectedOrigin) {
      return fallbackUrl;
    }
    return parsed.toString();
  } catch {
    return fallbackUrl;
  }
}

export function configurePassport(passport, pool, authConfig) {
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  if (!authConfig.googleClientId || !authConfig.googleClientSecret) {
    authLog('google_oauth_disabled', {
      callbackUrl: authConfig.callbackUrl,
      reason: 'missing_google_credentials',
    });
    return false;
  }

  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: authConfig.googleClientId,
        clientSecret: authConfig.googleClientSecret,
        callbackURL: authConfig.callbackUrl,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          authLog('google_profile_received', {
            googleId: profile.id,
            email: profile.emails?.[0]?.value || null,
          });

          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const fullName = profile.displayName;
          const avatarUrl = profile.photos?.[0]?.value || null;
          const emailVerified = profile.emails?.[0]?.verified || false;

          if (!email) {
            return done(new Error('No email found from Google account'), null);
          }

          const isAdminUser = email === authConfig.adminEmail;
          let result;

          try {
            result = await pool.query(
              `INSERT INTO users (google_id, full_name, email, avatar_url, email_verified, auth_provider, role, last_login_at)
               VALUES ($1, $2, $3, $4, $5, 'google', $6, CURRENT_TIMESTAMP)
               ON CONFLICT (google_id) DO UPDATE SET
                 full_name = EXCLUDED.full_name,
                 email = EXCLUDED.email,
                 avatar_url = EXCLUDED.avatar_url,
                 email_verified = EXCLUDED.email_verified,
                 auth_provider = 'google',
                 role = CASE WHEN $7 THEN 'admin' ELSE users.role END,
                 updated_at = CURRENT_TIMESTAMP,
                 last_login_at = CURRENT_TIMESTAMP
               RETURNING id, google_id, full_name, email, avatar_url, role`,
              [googleId, fullName, email, avatarUrl, emailVerified, isAdminUser ? 'admin' : 'user', isAdminUser]
            );
          } catch {
            result = await pool.query(
              `INSERT INTO users (google_id, full_name, email, avatar_url, email_verified, auth_provider, last_login_at)
               VALUES ($1, $2, $3, $4, $5, 'google', CURRENT_TIMESTAMP)
               ON CONFLICT (google_id) DO UPDATE SET
                 full_name = EXCLUDED.full_name,
                 email = EXCLUDED.email,
                 avatar_url = EXCLUDED.avatar_url,
                 email_verified = EXCLUDED.email_verified,
                 auth_provider = 'google',
                 updated_at = CURRENT_TIMESTAMP,
                 last_login_at = CURRENT_TIMESTAMP
               RETURNING id, google_id, full_name, email, avatar_url`,
              [googleId, fullName, email, avatarUrl, emailVerified]
            );

            if (result.rows[0]) {
              result.rows[0].role = isAdminUser ? 'admin' : 'user';
            }
          }

          return done(null, result.rows[0]);
        } catch (error) {
          authLog('google_oauth_error', { message: error.message });
          return done(error, null);
        }
      }
    )
  );

  authLog('google_oauth_configured', {
    callbackUrl: authConfig.callbackUrl,
    frontendUrl: authConfig.frontendUrl,
  });
  return true;
}

export function createAuthRouter({ authConfig, authenticateToken, passport, pool }) {
  const router = express.Router();
  const googleConfigured = Boolean(authConfig.googleClientId && authConfig.googleClientSecret);

  authLog('createAuthRouter', {
    googleConfigured,
    frontendUrl: authConfig.frontendUrl,
    backendUrl: authConfig.backendUrl,
    callbackUrl: authConfig.callbackUrl,
    isProduction: authConfig.isProduction,
  });

  router.get('/google', (req, res, next) => {
    authLog('google_route_reached', {
      host: req.get('host'),
      originalUrl: req.originalUrl,
      redirect: req.query.redirect || null,
      protocol: req.protocol,
    });

    if (!googleConfigured) {
      authLog('google_oauth_not_configured');
      return res.status(503).json({
        message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      });
    }

    const redirectUrl = getSafeRedirectUrl(req.query.redirect, authConfig.frontendUrl);
    authLog('google_authenticating', { redirectUrl, callbackURL: authConfig.callbackUrl });

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
      session: false,
      state: redirectUrl,
    })(req, res, next);
  });

  router.get('/google/callback', (req, res, next) => {
    authLog('google_callback_reached', {
      host: req.get('host'),
      hasCode: Boolean(req.query.code),
      hasError: Boolean(req.query.error),
      error: req.query.error || null,
      state: req.query.state || null,
    });

    if (req.query.error) {
      authLog('google_callback_error_from_google', { error: req.query.error });
      return res.redirect(`${authConfig.frontendUrl}/login?error=${encodeURIComponent(req.query.error)}`);
    }

    passport.authenticate('google', { session: false }, (error, user) => {
      if (error) {
        authLog('google_callback_auth_error', { message: error.message });
        return res.redirect(`${authConfig.frontendUrl}/login?error=google_auth_failed`);
      }

      if (!user) {
        authLog('google_callback_no_user');
        return res.redirect(`${authConfig.frontendUrl}/login?error=google_auth_failed`);
      }

      try {
        const token = generateToken(user, authConfig);
        setAuthCookie(res, token, authConfig);
        authLog('session_cookie_created', { userId: user.id, email: user.email });

        pool.query(
          `INSERT INTO user_sessions (user_id, ip_address, user_agent)
           VALUES ($1, $2, $3)`,
          [user.id, req.headers['x-forwarded-for'] || req.socket.remoteAddress || null, req.headers['user-agent'] || null]
        ).catch(() => {});

        const redirectUrl = getSafeRedirectUrl(req.query.state, authConfig.frontendUrl);
        authLog('google_redirect_success', { redirectUrl });
        return res.redirect(redirectUrl);
      } catch (callbackError) {
        authLog('google_callback_exception', { message: callbackError.message });
        return res.redirect(`${authConfig.frontendUrl}/login?error=auth_failed`);
      }
    })(req, res, next);
  });

  router.get('/me', authenticateToken, async (req, res) => {
    try {
      authLog('auth_me_request', { userId: req.user?.id });
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
        if (result.rows[0]) {
          result.rows[0].role = 'user';
          result.rows[0].auth_provider = 'email';
        }
      }

      if (result.rows.length === 0) {
        clearAuthCookie(res, authConfig);
        return res.status(401).json({ message: 'User not found' });
      }

      const user = result.rows[0];
      if (user.email?.toLowerCase() === authConfig.adminEmail && user.role !== 'admin') {
        try {
          await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
        } catch {}
        user.role = 'admin';
      }

      res.json({ user });
    } catch (error) {
      authLog('auth_me_failed', { message: error.message });
      res.status(500).json({ message: 'Failed to get user data' });
    }
  });

  router.post('/logout', async (req, res) => {
    const token = getRequestToken(req, authConfig);
    clearAuthCookie(res, authConfig);

    if (req.user?.id || token) {
      try {
        const decoded = req.user || jwt.verify(token, authConfig.jwtSecret);
        await pool.query(
          `UPDATE user_sessions
           SET logout_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND logout_at IS NULL`,
          [decoded.id]
        );
      } catch {}
    }

    authLog('logout_success');
    res.json({ message: 'Logged out successfully' });
  });

  return router;
}

