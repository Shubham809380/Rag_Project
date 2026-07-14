import 'dotenv/config';

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value && !fallback) {
    throw new Error(`[FATAL] Missing required environment variable: ${name}`);
  }
  return value;
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

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
if (!GEMINI_API_KEY || GEMINI_API_KEY.trim().length === 0) {
  throw new Error('[FATAL] GEMINI_API_KEY is empty or whitespace. Set a valid key.');
}
if (GEMINI_API_KEY.startsWith('"') || GEMINI_API_KEY.startsWith("'")) {
  console.warn('[WARN] GEMINI_API_KEY appears to have surrounding quotes. Remove them.');
}
const PINECONE_API_KEY = requireEnv('PINECONE_API_KEY');
const PINECONE_INDEX_NAME = requireEnv('PINECONE_INDEX_NAME');
const DATABASE_URL = requireEnv('DATABASE_URL');
const JWT_SECRET = requireEnv('JWT_SECRET', isVercel || isRender ? undefined : 'insightrag-dev-secret-change-in-production');

if (!JWT_SECRET) {
  throw new Error('[FATAL] JWT_SECRET is not set. Auth will be broken.');
}

const backendUrl = toAbsoluteUrl(optionalEnv('BACKEND_URL'), 'http://localhost:5000');
const frontendUrl = toAbsoluteUrl(optionalEnv('FRONTEND_URL'), 'http://localhost:5173');

const config = {
  isVercel,
  isRender,
  isProduction,
  port: parseInt(optionalEnv('PORT', '5000'), 10),

  gemini: {
    apiKey: GEMINI_API_KEY,
    embedModel: optionalEnv('GEMINI_EMBED_MODEL', 'gemini-embedding-001'),
    llmModels: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'],
    temperature: 0.2,
  },

  pinecone: {
    apiKey: PINECONE_API_KEY,
    indexName: PINECONE_INDEX_NAME,
    environment: optionalEnv('PINECONE_ENVIRONMENT', 'us-east-1'),
    host: optionalEnv('PINECONE_HOST', ''),
  },

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
    allowedExtensions: ['.pdf', '.docx', '.txt', '.csv'],
    maxFiles: 10,
    tempDir: isVercel ? '/tmp' : undefined,
  },

  pipeline: {
    timeoutMs: isVercel ? 40000 : 120000,
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
};

export default config;
