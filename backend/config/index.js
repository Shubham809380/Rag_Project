import 'dotenv/config';
import sovereign from './sovereign.js';

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value && !fallback) {
    throw new Error(`[FATAL] Missing required environment variable: ${name}`);
  }
  return value;
}

function warnOnce(key, msg) {
  if (!process.env[`__WARN_${key}`]) {
    process.env[`__WARN_${key}`] = '1';
    console.warn(`[WARN] ${msg}`);
  }
}

function optionalEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

function toAbsoluteUrl(value, fallback) {
  const raw = (value || fallback || '').replace(/\/+$/, '');
  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

const isVercel = !!process.env.VERCEL;
const isRender = !!process.env.RENDER;
const isProduction = process.env.NODE_ENV === 'production';

// ── Sovereign-aware cloud dependency resolution ─────────────────────────────
// In local/air-gapped mode cloud keys are NOT required. They are required only
// for the online build/staging domain.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || '';

if (GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 0 && (GEMINI_API_KEY.startsWith('"') || GEMINI_API_KEY.startsWith("'"))) {
  warnOnce('gemini-quotes', 'GEMINI_API_KEY appears to have surrounding quotes. Remove them.');
}
if (sovereign.mode === 'online') {
  if (!GEMINI_API_KEY) throw new Error('[FATAL] SOVEREIGN_MODE=online requires GEMINI_API_KEY');
  if (!PINECONE_API_KEY || !PINECONE_INDEX_NAME) warnOnce('pinecone', 'SOVEREIGN_MODE=online but PINECONE_* keys are missing — VectorStore fallback will be used.');
}
const DATABASE_URL = process.env.DATABASE_URL || '';
// Hardening: no hard-coded fallback signing key. In the old code a missing
// JWT_SECRET silently fell back to a known dev string — a usable default secret
// is a vulnerability in any deployment. Now the server refuses to start.
const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  const detail = sovereign.mode === 'local'
    ? 'Classic-domain auth is disabled unless JWT_SECRET is set (sovereign domain uses SOVEREIGN_JWT_SECRET).'
    : 'Set JWT_SECRET to a strong random value (>=32 chars).';
  throw new Error(`[FATAL] JWT_SECRET is not set. ${detail}`);
}

// On Render, prefer RENDER_EXTERNAL_URL; fall back to BACKEND_URL
const backendUrl = toAbsoluteUrl(
  optionalEnv('BACKEND_URL') || optionalEnv('RENDER_EXTERNAL_URL'),
  'http://localhost:5000'
);
const frontendUrl = toAbsoluteUrl(optionalEnv('FRONTEND_URL'), 'http://localhost:5173');

const config = {
  isVercel,
  isRender,
  isProduction,
  port: parseInt(optionalEnv('PORT', '5000'), 10),

  gemini: {
    apiKey: GEMINI_API_KEY,
    enabled: !!GEMINI_API_KEY,
    embedModel: optionalEnv('GEMINI_EMBED_MODEL', 'gemini-embedding-001'),
    llmModels: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'],
    temperature: 0.2,
  },

  pinecone: {
    apiKey: PINECONE_API_KEY,
    indexName: PINECONE_INDEX_NAME,
    environment: optionalEnv('PINECONE_ENVIRONMENT', 'us-east-1'),
    host: optionalEnv('PINECONE_HOST', ''),
    enabled: !!(PINECONE_API_KEY && PINECONE_INDEX_NAME),
  },

  sovereign,

  database: {
    url: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: parseInt(optionalEnv('DB_POOL_MAX', '10'), 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },

  auth: {
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: '7d',
    cookieName: 'auth_token',
    googleClientId: optionalEnv('GOOGLE_CLIENT_ID'),
    googleClientSecret: optionalEnv('GOOGLE_CLIENT_SECRET'),
    callbackUrl: toAbsoluteUrl(
      optionalEnv('GOOGLE_CALLBACK_URL'),
      `${backendUrl}/api/auth/google/callback`
    ),
    adminEmail: optionalEnv('ADMIN_EMAIL', 'patrashubhamm031@gmail.com').toLowerCase(),
    frontendUrl,
    backendUrl,
  },

  upload: {
    maxFileSize: 20 * 1024 * 1024,
    allowedExtensions: ['.pdf', '.docx', '.txt', '.csv', '.xlsx', '.md', '.png', '.jpg', '.jpeg'],
    maxFiles: 10,
    tempDir: '/tmp',
  },

  pipeline: {
    timeoutMs: 120000,
    chunkSize: 850,
    chunkMaxSize: 1000,
    chunkMinSize: 50,
    overlapChars: 180,
    queryTopK: 25,
    finalChunksMin: 5,
    finalChunksMax: 8,
    similarityThreshold: 0.15,
    embedBatchSize: 10,
    pineconeUpsertBatch: 20,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    uploadMax: 20,
  },

  // Web research
  websearch: {
    provider: optionalEnv('WEBSEARCH_PROVIDER', 'duckduckgo'), // duckduckgo | serpapi | brave | tavily
    apiKey: optionalEnv('WEBSEARCH_API_KEY', ''),
    engine: optionalEnv('WEBSEARCH_ENGINE', 'duckduckgo'),
  },

  // Voice (STT / TTS) - provider abstraction
  voice: {
    sttProvider: optionalEnv('STT_PROVIDER', 'browser'), // browser | gemini | whisper
    ttsProvider: optionalEnv('TTS_PROVIDER', 'browser'), // browser | gemini
    sttApiKey: optionalEnv('STT_API_KEY', ''),
    ttsApiKey: optionalEnv('TTS_API_KEY', ''),
    langs: ['en-IN', 'hi-IN', 'or-IN'],
  },

  // i18n supported UI languages
  i18n: {
    defaultLanguage: 'en',
    languages: ['en', 'hi', 'hinglish', 'or'],
  },

  // Default RAG / agent settings for new users
  defaults: {
    model: 'gemini-2.0-flash',
    temperature: 0.2,
    retrievalDepth: 5,
    responseLength: 'balanced',
    ragMode: 'hybrid',
    agentMode: false,
    webResearch: false,
    language: 'en',
  },

  // Admin RAG evaluation test questions
  evalQuestions: [
    'What are the main findings in my documents?',
    'Summarize the key points across all documents.',
    'What contradictions exist between the documents?',
  ],
};

export default config;
