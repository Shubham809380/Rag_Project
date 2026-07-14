import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import config from './backend/config/index.js';
import { configurePassport } from './backend/controllers/auth.controller.js';
import { notFound, errorHandler, uncaughtHandlers } from './backend/middleware/error.middleware.js';
import { globalLimiter } from './backend/middleware/rateLimit.middleware.js';
import apiRouter from './backend/routes/index.js';
import logger from './backend/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG = 'Server';
const isVercel = config.isVercel;

uncaughtHandlers();

logger.info(LOG, 'Starting', {
  isVercel,
  nodeEnv: config.isProduction ? 'production' : 'development',
  hasGemini: Boolean(config.gemini.apiKey),
  hasPinecone: Boolean(config.pinecone.apiKey),
  hasGoogleOAuth: Boolean(config.auth.googleClientId && config.auth.googleClientSecret),
});

const app = express();

app.set('trust proxy', 1);

// Cookies
app.use(cookieParser());

// CORS
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = [config.auth.frontendUrl];

  if (isVercel && process.env.VERCEL_URL) {
    const vercelUrl = `https://${process.env.VERCEL_URL}`;
    if (!allowedOrigins.includes(vercelUrl)) allowedOrigins.push(vercelUrl);
  }

  const origin = requestOrigin || '';
  const isAllowed = !origin || allowedOrigins.includes(origin);

  if (isAllowed) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Passport
app.use(passport.initialize());
try {
  configurePassport();
  logger.info(LOG, 'Passport configured');
} catch (err) {
  logger.error(LOG, 'Passport config failed', { error: err.message });
}

// Rate limiting (skip on Vercel since edge middleware handles it)
if (!isVercel) {
  app.use('/api', globalLimiter);
}

// Auto-migration on startup (skip on Vercel - run via /api/admin/migrate instead)
if (!isVercel) {
  (async () => {
    try {
      const pool = (await import('./backend/db.js')).default;
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT \'user\'');
      await pool.query(`CREATE TABLE IF NOT EXISTS page_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        email VARCHAR(255), page VARCHAR(500) NOT NULL,
        ip_address VARCHAR(45), user_agent TEXT, referrer TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_page_visits_user_id ON page_visits(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON page_visits(created_at)');
      await pool.query(`CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        login_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        logout_at TIMESTAMPTZ, ip_address VARCHAR(45), user_agent TEXT)`);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)');
      logger.info(LOG, 'Auto-migration complete');
    } catch (err) {
      logger.error(LOG, 'Auto-migration failed', { error: err.message });
    }
  })();
}

// API routes
app.use('/api', apiRouter);

// Serve frontend build (non-Vercel)
const frontendBuild = path.join(__dirname, 'frontend', 'dist');
if (!isVercel && fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(frontendBuild, 'index.html'));
    }
    next();
  });
}

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

// Start server
if (!isVercel) {
  const server = app.listen(config.port, () => {
    logger.info(LOG, `Server running on http://localhost:${config.port}`);
    logger.info(LOG, 'Routes mounted', {
      auth: '/api/auth',
      upload: 'POST /api/upload',
      documents: 'GET /api/documents',
      analyze: 'POST /api/analyze',
      conversations: 'GET /api/conversations',
      history: 'GET /api/history',
      user: '/api/user',
      admin: '/api/admin',
      debug: '/api/debug',
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(LOG, `Port ${config.port} already in use`);
    } else {
      logger.error(LOG, 'Server error', { error: err.message });
    }
  });
}

export { app };
