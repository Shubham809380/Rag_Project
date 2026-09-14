import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────────────────────
// Sovereign AI Workbench — configuration
//
// The sovereign configuration governs the AIR-GAPPED execution domain.
// It is fully independent of GEMINI_API_KEY / PINECONE_API_KEY and must never
// depend on cloud availability.
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function optionalEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

function intEnv(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : fallback;
}

// SOVEREIGN_MODE: 'local'   → air-gapped execution domain (default)
//                'online'   → build/staging domain (cloud keys may be present)
const SOVEREIGN_MODE = (optionalEnv('SOVEREIGN_MODE', 'local') || 'local').toLowerCase();

// POSTGRES vs SQLITE storage for sovereign domain tables
const STORAGE_BACKEND = (optionalEnv('SOVEREIGN_STORAGE', 'sqlite') || 'sqlite').toLowerCase();

const DATA_DIR = path.resolve(optionalEnv('SOVEREIGN_DATA_DIR', path.join(ROOT, 'sovereign', 'data')));
const ARTIFACT_DIR = path.resolve(optionalEnv('SOVEREIGN_ARTIFACT_DIR', path.join(ROOT, 'sovereign', 'artifacts')));
const WORKSPACE_DIR = path.resolve(optionalEnv('SOVEREIGN_WORKSPACE_DIR', path.join(ROOT, 'sovereign', 'workspace')));
const AUDIT_DIR = path.resolve(optionalEnv('SOVEREIGN_AUDIT_DIR', path.join(ROOT, 'sovereign', 'audit')));
const UPLOAD_DIR = path.resolve(optionalEnv('SOVEREIGN_UPLOAD_DIR', path.join(ROOT, 'sovereign', 'uploads')));

// Local inference gateway (Ollama / vLLM OpenAI-compatible endpoint)
const LOCAL_GATEWAY_BASE = optionalEnv('LOCAL_GATEWAY_BASE', 'http://127.0.0.1:11434');
// When set, treat the gateway as OpenAI-compatible (/v1/chat/completions, /v1/embeddings).
// When unset, fall back to Ollama native endpoints (/api/chat, /api/embed).
const LOCAL_GATEWAY_OPENAI_COMPAT = (optionalEnv('LOCAL_GATEWAY_OPENAI_COMPAT', '') || '').toLowerCase() === 'true';

// Embedding fallback: deterministic hashed token (n-gram) embedder used ONLY when
// no local embedding model is reachable. Marked as low-fidelity fallback.
const ALLOW_FALLBACK_EMBEDDINGS = (optionalEnv('SOVEREIGN_ALLOW_FALLBACK_EMBEDDINGS', 'true') || '').toLowerCase() === 'true';

// Network egress behaviour inside the node process:
//   'deny'    → block outbound http/https/dns to non-private hosts (air-gap default)
//   'monitor' → record outbound attempts but allow (build/staging)
//   'off'     → no interception
const EGRESS_MODE = (optionalEnv('SOVEREIGN_EGRESS', SOVEREIGN_MODE === 'local' ? 'deny' : 'monitor') || 'monitor').toLowerCase();

// Connectivity probe: performs REAL short TCP connects to probe targets to
// establish "Internet Connectivity" status. Default probe: 1.1.1.1:53, 8.8.8.8:53.
const PROBE_ENABLED = (optionalEnv('SOVEREIGN_PROBE', 'true') || '').toLowerCase() === 'true';
const PROBE_TARGETS = (optionalEnv('SOVEREIGN_PROBE_TARGETS', '1.1.1.1:53,8.8.8.8:53')
  .split(',').map(s => s.trim()).filter(Boolean));

// Demo identity — development convenience. NEVER enable in production.
// When SOVEREIGN_DEMO_USER is set, /api/sovereign/demo-login issues a scoped JWT.
const DEMO_USER_ID = optionalEnv('SOVEREIGN_DEMO_USER_ID', '');
const DEMO_USER_EMAIL = optionalEnv('SOVEREIGN_DEMO_USER_EMAIL', '');
const DEMO_USER_NAME = optionalEnv('SOVEREIGN_DEMO_USER_NAME', 'Demo Inspector');
const DEMO_USER_ROLE = optionalEnv('SOVEREIGN_DEMO_USER_ROLE', 'inspector');

// DEMO_MODE governs demo/header-based identity shortcuts.
//   '' / 'false' → default. No header identity. Production-safe.
//   'true' / 'auto' → non-production only. Allows x-sovereign-role/user headers.
// The header path is REJECTED whenever NODE_ENV=production, regardless of flag.
const DEMO_MODE = (optionalEnv('DEMO_MODE', '') || '').toLowerCase();
const DEMO_MODE_ENABLED = DEMO_MODE === 'true' || DEMO_MODE === 'auto' || DEMO_MODE === '1';

export const IS_DEMO_MODE = DEMO_MODE_ENABLED;

const sovereign = {
  mode: SOVEREIGN_MODE, // 'local' | 'online'
  isLocal: SOVEREIGN_MODE === 'local',
  storage: {
    backend: STORAGE_BACKEND, // 'sqlite' | 'postgres'
    sqlitePath: path.join(DATA_DIR, 'sovereign.sqlite'),
    dataDir: DATA_DIR,
  },
  paths: { dataDir: DATA_DIR, artifactDir: ARTIFACT_DIR, workspaceDir: WORKSPACE_DIR, auditDir: AUDIT_DIR, uploadDir: UPLOAD_DIR },
  provider: {
    baseUrl: LOCAL_GATEWAY_BASE,
    openaiCompat: LOCAL_GATEWAY_OPENAI_COMPAT,
    timeoutMs: intEnv('LOCAL_GATEWAY_TIMEOUT_MS', 600000),
    // vLLM requires an api-key header (e.g. "EMPTY"/"token-abc"). Ollama ignores it.
    apiKey: optionalEnv('LOCAL_GATEWAY_API_KEY', 'EMPTY'),
  },
  embeddings: {
    allowFallback: ALLOW_FALLBACK_EMBEDDINGS,
    fallbackDim: intEnv('SOVEREIGN_FALLBACK_EMBED_DIM', 384),
    preferredModel: optionalEnv('LOCAL_EMBED_MODEL', 'nomic-embed-text'),
  },
  network: {
    egressMode: EGRESS_MODE,
    probeEnabled: PROBE_ENABLED,
    probeTargets: PROBE_TARGETS,
    probeTimeoutMs: intEnv('SOVEREIGN_PROBE_TIMEOUT_MS', 2500),
    // Hosts always allowed even in deny mode (loopback/private are already allowed).
    externalAllowlist: optionalEnv('SOVEREIGN_EGRESS_ALLOWLIST', '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  },
  demo: {
    // The fixed demo user NEVER activates automatically just because
    // SOVEREIGN_DEMO_USER_* variables exist. It requires an explicit
    // DEMO_MODE=true/auto flag as well. Default = DEMO_MODE off = real auth.
    enabled: DEMO_MODE_ENABLED && !!DEMO_USER_ID,
    userId: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    name: DEMO_USER_NAME,
    role: DEMO_USER_ROLE,
    demoModeEnabled: DEMO_MODE_ENABLED,
  },
  auth: {
    // NO hard-coded fallback secret. SOVEREIGN_JWT_SECRET is the DEDICATED secret
    // for the sovereign domain. JWT_SECRET is accepted ONLY as a development
    // convenience; assertSecureSecrets() fails fast in production when
    // SOVEREIGN_JWT_SECRET is missing — the sovereign domain never silently
    // inherits the classic-domain secret in production.
    jwtSecret: process.env.SOVEREIGN_JWT_SECRET || process.env.JWT_SECRET || '',
    jwtExpiresIn: optionalEnv('SOVEREIGN_JWT_TTL', '8h'),
    cookieName: 'sovereign_token',
    cookieMaxAgeMs: intEnv('SOVEREIGN_COOKIE_MAX_AGE_MS', 8 * 60 * 60 * 1000),
    sessionRecord: true,
    // Admin bootstrap: first admin user created from env at first boot (air-gap friendly).
    bootstrapAdminEmail: (optionalEnv('SOVEREIGN_ADMIN_EMAIL', '') || '').toLowerCase(),
    bootstrapAdminPassword: optionalEnv('SOVEREIGN_ADMIN_PASSWORD', ''),
    bootstrapAdminName: optionalEnv('SOVEREIGN_ADMIN_NAME', 'Sovereign Administrator'),
    requireBootstrapAdmin: (optionalEnv('SOVEREIGN_REQUIRE_ADMIN_BOOTSTRAP', 'false') || '').toLowerCase() === 'true',
    minPasswordLength: intEnv('SOVEREIGN_MIN_PASSWORD_LENGTH', 12),
    maxLoginAttempts: intEnv('SOVEREIGN_MAX_LOGIN_ATTEMPTS', 5),
    lockoutMs: intEnv('SOVEREIGN_LOCKOUT_MS', 15 * 60 * 1000),
  },
  // Hardware-aware model selection profile.
  hardwareProfile: (optionalEnv('SOVEREIGN_HW_PROFILE', 'small') || 'small').toLowerCase(), // small | mid | large
  // Human approval gates.
  approvals: {
    requireForMedium: (optionalEnv('SOVEREIGN_APPROVE_MEDIUM', 'false') || '').toLowerCase() === 'true',
    reviewRecommended: ['engineering_recommendation', 'maintenance', 'vocational_advice'],
    mandatory: ['safety_conclusion', 'financial_commitment', 'procurement', 'approval_issuance', 'external_communication', 'operational_change', 'production_action'],
  },
  // Agent guards.
  agent: {
    maxSteps: intEnv('SOVEREIGN_AGENT_MAX_STEPS', 24),
    maxToolCalls: intEnv('SOVEREIGN_AGENT_MAX_TOOL_CALLS', 16),
    maxCodeExecutions: intEnv('SOVEREIGN_AGENT_MAX_CODE_EXEC', 4),
    defaultTimeoutMs: intEnv('SOVEREIGN_AGENT_TIMEOUT_MS', 180000),
    retrievalK: intEnv('SOVEREIGN_AGENT_RETRIEVAL_K', 8),
  },
  model: {
    // Explicit model allowlist (empty = everything configured is allowed).
    // When set, any model id NOT in the list is refused at the router: the
    // security boundary is LOCAL MODELS + NETWORK ISOLATION + EGRESS + AUTH + AUDIT.
    allowlist: (optionalEnv('SOVEREIGN_MODEL_ALLOWLIST', '') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  },
  rag: {
    // Minimum hybrid relevance threshold. Above 0, retrieval that scores below
    // this returns "Insufficient verified evidence" instead of forcing an answer.
    minRelevance: parseFloat(optionalEnv('SOVEREIGN_MIN_RELEVANCE', '0')) || 0,
  },
  sandbox: {
    dockerImage: optionalEnv('SOVEREIGN_SANDBOX_IMAGE', 'python:3.12-slim'),
    memoryLimit: optionalEnv('SOVEREIGN_SANDBOX_MEMORY', '512m'),
    cpuLimit: optionalEnv('SOVEREIGN_SANDBOX_CPU', '1.0'),
    timeoutMs: intEnv('SOVEREIGN_SANDBOX_TIMEOUT_MS', 60000),
    enableDocker: (optionalEnv('SOVEREIGN_SANDBOX', 'auto') || 'auto').toLowerCase() === 'auto' ? null : (optionalEnv('SOVEREIGN_SANDBOX', 'auto').toLowerCase() === 'true'),
    // Off by default for safety: when Docker is absent, run code with the host
    // Python interpreter (same static guard + timeouts, but NOT process-isolated).
    // Results are labelled "host fallback" so the UI can be honest about it.
    hostFallback: (optionalEnv('SOVEREIGN_HOST_FALLBACK', 'false') || 'false').toLowerCase() === 'true',
  },
  audit: {
    retentionDays: intEnv('SOVEREIGN_AUDIT_RETENTION_DAYS', 365),
    jsonlEnabled: (optionalEnv('SOVEREIGN_AUDIT_JSONL', 'true') || '').toLowerCase() === 'true',
  },
  backup: {
    enabled: (optionalEnv('SOVEREIGN_BACKUP', 'true') || '').toLowerCase() === 'true',
    dir: path.resolve(optionalEnv('SOVEREIGN_BACKUP_DIR', path.join(ROOT, 'sovereign', 'backups'))),
    intervalMs: intEnv('SOVEREIGN_BACKUP_INTERVAL_MS', 3600 * 1000),
    retention: intEnv('SOVEREIGN_BACKUP_RETENTION', 7),            // keep N most recent backups
    maintenanceIntervalMs: intEnv('SOVEREIGN_MAINTENANCE_INTERVAL_MS', 3600 * 1000),
  },
};

// Dev/fallback secrets that must NEVER be used for a production signing key.
const KNOWN_DEV_SECRETS = [
  'sovereign-local-dev-secret-change-me',
  'insightrag-dev-secret-change-in-production',
  'insightrag-sovereign-local-secret',
  '',
];

// Fail-fast, startup-time secret validation. Called from server.js on boot.
// Production policy: the sovereign domain MUST use its own dedicated
// SOVEREIGN_JWT_SECRET. It never silently falls back to the classic JWT_SECRET.
export function assertSecureSecrets({ production = process.env.NODE_ENV === 'production' } = {}) {
  const s = sovereign.auth.jwtSecret;
  if (!s) {
    throw new Error('[FATAL] No Sovereign JWT secret configured. Set SOVEREIGN_JWT_SECRET (or JWT_SECRET for development only). Refusing to start with an empty secret.');
  }
  if (production) {
    if (!process.env.SOVEREIGN_JWT_SECRET) {
      throw new Error('[FATAL] SOVEREIGN_JWT_SECRET is not set. The sovereign domain requires its own dedicated secret in production — refusing to fall back to JWT_SECRET.');
    }
    if (s.length < 32) throw new Error('[FATAL] Sovereign JWT secret must be at least 32 characters in production.');
    if (KNOWN_DEV_SECRETS.includes(s)) throw new Error('[FATAL] The configured Sovereign JWT secret is a known development placeholder. Set a strong unique SOVEREIGN_JWT_SECRET.');
    const demoFlag = String(process.env.DEMO_MODE || '').toLowerCase();
    if (demoFlag === 'true' || demoFlag === 'auto' || demoFlag === '1') {
      throw new Error('[FATAL] DEMO_MODE/demo identity must NEVER be enabled in production. Set DEMO_MODE=false (or unset) before go-live.');
    }
  }
  if (KNOWN_DEV_SECRETS.slice(0, -1).includes(s) && !production) {
    console.warn('[WARN] Sovereign JWT secret is a known development placeholder — set a strong unique SOVEREIGN_JWT_SECRET for any real use.');
  }
  return sovereign.auth.jwtSecret;
}

export { SOVEREIGN_MODE, STORAGE_BACKEND };
export default sovereign;