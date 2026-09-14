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

uncaughtHandlers();

// ── SECURITY FAIL-FAST (hardening) ──────────────────────────────────────────
// A production Sovereign Workbench must NEVER boot with a missing, known or
// weak signing secret. This check runs at import time and aborts the process.
try {
  const { assertSecureSecrets } = await import('./backend/config/sovereign.js');
  assertSecureSecrets();
} catch (err) {
  logger.error(LOG, 'SECURITY FAIL-FAST', { error: err.message });
  process.exitCode = 1;
  throw err;
}

logger.info(LOG, 'Starting', {
  isRender: config.isRender,
  nodeEnv: config.isProduction ? 'production' : 'development',
  hasGemini: Boolean(config.gemini.apiKey),
  hasPinecone: Boolean(config.pinecone.apiKey),
  hasGoogleOAuth: Boolean(config.auth.googleClientId && config.auth.googleClientSecret),
});

// ── Sovereign Workbench boot (air-gapped domain) ────────────────────────────
try {
  const { getSovereignDB } = await import('./backend/storage/sovereignDB.js');
  const { monitor } = await import('./backend/monitor/monitor.js');
  const { modelRegistry } = await import('./backend/models/registry.js');
  const { isDockerAvailable } = await import('./backend/sandbox/docker.js');
  const { probeProviders } = await import('./backend/ocr/ocrService.js');
  getSovereignDB().init();
  monitor().init();
  await modelRegistry.syncFromProvider().catch(() => {}); // marks models honestly on first check
  const [sov, ocrProbe, docker] = await Promise.all([
    config.sovereign,
    probeProviders(),
    isDockerAvailable(),
  ]);
  const modelsAvailable = getSovereignDB().listModels().filter(m => m.status === 'available').length;
  const ocrState = ocrProbe.tesseract
    ? `AVAILABLE (tesseract ${ocrProbe.tesseractVersion})`
    : ocrProbe.visionModel
      ? 'AVAILABLE (local vision OCR only)'
      : 'UNAVAILABLE (install Tesseract/Paddle to enable)';
  const sovCfg = {
    'Sovereign Mode': sov.mode,
    'Egress': sov.network?.egressMode ?? 'deny',
    'Storage': sov.storage?.backend ?? 'sqlite',
    'Ollama': modelsAvailable > 0 || sov.provider?.baseUrl ? (modelsAvailable > 0 ? 'CONNECTED' : 'DISCONNECTED (0 models)') : 'DISCONNECTED',
    'Models': modelsAvailable,
    'OCR': ocrState,
    'Docker': docker ? 'AVAILABLE' : 'UNAVAILABLE',
    'Cloud Fallback': 'DISABLED',
    'Demo Mode': sov.demo?.demoModeEnabled ? 'ENABLED (DEV ONLY)' : 'OFF — mandatory auth',
  };
  logger.info(LOG, 'Sovereign startup validation', sovCfg);
  // Refuse to start a "production" sovereign domain with a broken egress guard.
  if (config.isProduction && (sov.mode !== 'local' || sov.network?.egressMode !== 'deny')) {
    logger.warn(LOG, 'PRODUCTION guard: sovereign domain is not local+deny. Review SOVEREIGN_MODE/SOVEREIGN_EGRESS before go-live.');
  }
} catch (err) {
  logger.error(LOG, 'Sovereign workbench boot failed (continuing with classic app)', { error: err.message });
}

// Bootstrap sovereign administrator from env (air-gap friendly; no cloud involved).
try {
  const { ensureBootstrapAdmin } = await import('./backend/security/sovereignAuth.js');
  await ensureBootstrapAdmin();
} catch (err) {
  logger.error(LOG, 'Sovereign admin bootstrap failed', { error: err.message });
}

// Scheduled Sovereign maintenance: WAL-safe backups + audit retention (hardening).
try {
  const { startMaintenance } = await import('./backend/maintenance/retention.js');
  startMaintenance();
} catch (err) {
  logger.error(LOG, 'Sovereign maintenance scheduler failed', { error: err.message });
}

const app = express();

app.set('trust proxy', 1);

// Cookies
app.use(cookieParser());

// CORS
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = [config.auth.frontendUrl];

  if (requestOrigin) {
    const isAllowed = allowedOrigins.includes(requestOrigin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
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

// Rate limiting
app.use('/api', globalLimiter);

// Auto-migration on startup — runs ONLY when the app is in the online Postgres
// domain. In sovereign local/air-gapped mode (SQLite) this must never probe
// cloud DBs, even if DATABASE_URL is incidentally present in the environment.
(async () => {
  const isLocalSovereign = config.sovereign?.mode === 'local';
  if (isLocalSovereign || !process.env.DATABASE_URL) {
    logger.info(LOG, `Auto-migration skipped (${isLocalSovereign ? 'local sovereign/SQLite mode' : 'no DATABASE_URL'})`);
    return;
  }
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
    const { runMigrationsV2 } = await import('./backend/migrate-v2.js');
    await runMigrationsV2(pool);
    logger.info(LOG, 'Auto-migration complete');
  } catch (err) {
    logger.error(LOG, 'Auto-migration failed', { error: err.message });
  }
})();

// API routes
app.use('/api', apiRouter);

// Root + health endpoints
app.get('/', (_req, res) => {
  res.json({ name: 'InsightRAG API', status: 'running', health: '/health', api: '/api' });
});
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

// Start server
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

export { app };
