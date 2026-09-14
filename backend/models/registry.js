import { getSovereignDB } from '../storage/sovereignDB.js';
import sovereign from '../config/sovereign.js';
import { getLocalProvider } from '../providers/index.js';
import logger from '../utils/logger.js';
import { ROLE_BY_TASK, TASK_REQUIREMENTS, CAPABILITIES } from './capabilities.js';

const LOG = 'ModelRegistry';
const SOVEREIGN_MODEL_SYNC_TTL_MS = 30_000;
// A slot that failed once should be retried quickly: heavy local models often
// fail once during a model-swap and then work fine. Keep the degrade window
// short so a single transient blip does not lock a slot out of a live demo.
const MODEL_FAILURE_COOLDOWN_MS = 2 * 60 * 1000;

// Model keys map to actual gateway model ids. Builtin defaults are hardware-profile
// aware and can be overridden by admin. The EXACT model id is never hard-coded in
// business logic — only these slot keys are referenced.
//
// MVP stack (MRPL 26117): qwen3:8b (reasoning/agent), qwen3-vl:8b (vision/OCR),
// nomic-embed-text (embeddings). Coding reuses the reasoning model for the MVP;
// swap coding_local to a dedicated coder (e.g. qwen3-coder) with no other change.
//
// Env overrides let an operator adapt the SAME profile to constrained hardware
// without touching code — e.g. SOVEREIGN_MODEL_REASONING=llama3.2 switches the
// reasoning slot to a ~2GB model for laptops, while the reference box keeps qwen3:8b.
const ENV_MODELS = {
  reasoning_local: process.env.SOVEREIGN_MODEL_REASONING,
  coding_local: process.env.SOVEREIGN_MODEL_CODING,
  vision_local: process.env.SOVEREIGN_MODEL_VISION,
  embedding_embed: process.env.SOVEREIGN_MODEL_EMBED,
};

const MODEL_SLOTS = {
  reasoning_local: { key: 'reasoning_local', modelId: ENV_MODELS.reasoning_local || 'qwen3:8b', profile: 'small' },
  coding_local: { key: 'coding_local', modelId: ENV_MODELS.coding_local || 'qwen3:8b', profile: 'small' },
  vision_local: { key: 'vision_local', modelId: ENV_MODELS.vision_local || 'qwen3-vl:8b', profile: 'small' },
  embedding_embed: { key: 'embedding_embed', modelId: ENV_MODELS.embedding_embed || 'nomic-embed-text', profile: 'small' },
  reasoning_mid: { key: 'reasoning_mid', modelId: 'qwen3:14b', profile: 'mid' },
  coding_mid: { key: 'coding_mid', modelId: 'qwen3-coder:30b-a3b', profile: 'mid' },
  vision_mid: { key: 'vision_mid', modelId: 'qwen3-vl:32b', profile: 'mid' },
  reasoning_large: { key: 'reasoning_large', modelId: 'qwen3:32b', profile: 'large' },
  coding_large: { key: 'coding_large', modelId: 'qwen3-coder:30b-a3b', profile: 'large' },
  vision_large: { key: 'vision_large', modelId: 'qwen3-vl:32b', profile: 'large' },
};

const PROFILE_ORDER = { small: 0, mid: 1, large: 2 };

export function resolveModelId(slotKey) {
  const slot = MODEL_SLOTS[slotKey];
  return slot?.modelId || slotKey;
}

export function slotFor(role, profile = sovereign.hardwareProfile) {
  if (profile === 'large') {
    if (role === 'coding') return 'coding_large';
    if (role === 'vision') return 'vision_large';
    return 'reasoning_large';
  }
  if (profile === 'mid') {
    if (role === 'coding') return 'coding_mid';
    if (role === 'vision') return 'vision_mid';
    return 'reasoning_mid';
  }
  if (role === 'coding') return 'coding_local';
  if (role === 'vision') return 'vision_local';
  if (role === 'embedding') return 'embedding_embed';
  return 'reasoning_local';
}

const hasAll = (caps, need) => need.every(n => caps.includes(n));

export class ModelRegistry {
  constructor() { this.db = null; this._syncTs = 0; this._lastAvailableIds = []; }

  _db() { return this.db || (this.db = getSovereignDB()); }

  // Persisted admins/managed entries.
  all() { return this._db().listModels(); }

  // Gateway sync with a short TTL so standalone scripts, the server, and the
  // eval harness all see live availability without hammering the gateway.
  async syncFromProvider({ force = false } = {}) {
    if (!force && this._syncTs && Date.now() - this._syncTs < SOVEREIGN_MODEL_SYNC_TTL_MS) {
      return this._lastAvailableIds;
    }
    const provider = getLocalProvider();
    let availableIds = [];
    let gatewayError = null;
    try {
      const models = await provider.listModels();
      // Ollama native /api/tags may return ":latest" suffixes; normalize so slot
      // ids like "nomic-embed-text" match "nomic-embed-text:latest".
      availableIds = models.map(m => String(m.id).replace(/:latest$/, ''));
      logger.info(LOG, `Local gateway reports ${availableIds.length} models`, { availableIds: availableIds.slice(0, 10) });
    } catch (err) {
      gatewayError = err.message;
      logger.warn(LOG, 'Local gateway unreachable; models marked error/unavailable', { error: err.message });
    }
    const entries = this._db().listModels();
    for (const m of entries) {
      if (m.provider !== 'local') continue;
      const slotKey = m.modelKey;
      const expectedId = MODEL_SLOTS[slotKey]?.modelId;
      const found = expectedId ? availableIds.includes(expectedId) : availableIds.includes(m.modelKey);
      // Model health states: available | unavailable | degraded | error.
      //  * error    → gateway could not be queried (fetch failed/timeout).
      //  * degraded → present on the gateway but a recent invocation failed.
      //  (detected from actual generation/embedding attempts, not synthetic pings)
      const status = gatewayError
        ? 'error'
        : found
          ? (this._hasRecentFailure(m.modelKey) ? 'degraded' : 'available')
          : 'unavailable';
      if (m.status !== status) this._db().setModelStatus(m.modelKey, status);
    }
    this._syncTs = Date.now();
    this._lastAvailableIds = availableIds;
    return availableIds;
  }

  // A real invocation failed on this slot — surface it in the health model as
  // DEGRADED until the gateway proves usable again (TTL window).
  markModelFailure(modelKey, reason = '') {
    const now = Date.now();
    if (!this._failures) this._failures = new Map();
    this._failures.set(modelKey, { ts: now, reason });
  }

  _hasRecentFailure(modelKey) {
    if (!this._failures || !this._failures.has(modelKey)) return false;
    const f = this._failures.get(modelKey);
    if (Date.now() - f.ts > MODEL_FAILURE_COOLDOWN_MS) { this._failures.delete(modelKey); return false; }
    return true;
  }

  clearFailures(modelKey) {
    if (this._failures) this._failures.delete(modelKey);
  }

  // Best model for a role given the chosen hardware profile.
  bestForRole(role, profile = sovereign.hardwareProfile) {
    const slotKey = slotFor(role, profile);
    const db = this._db();
    const entry = db.getModelByKey(slotKey);
    return entry || db.upsertModel({ modelKey: slotKey, name: slotKey, role, capabilities: [CAPABILITIES.TEXT_GENERATION], provider: 'local', status: 'configured', profile });
  }

  // Models satisfying required capabilities, filtered by availability and profile.
  matchCapabilities(caps, { profile = null, availableOnly = true } = {}) {
    const entries = this._db().listModels();
    const profileRank = profile ? PROFILE_ORDER[profile] : Infinity;
    return entries
      .filter(m => hasAll(m.capabilities || [], caps))
      .filter(m => !availableOnly || (m.status === 'available'))
      .sort((a, b) => {
        // Closest profile first (or any when profile not given), then role fit.
        const ar = profileRank !== Infinity && PROFILE_ORDER[a.profile] !== undefined ? Math.abs(PROFILE_ORDER[a.profile] - profileRank) : 0;
        const br = profileRank !== Infinity && PROFILE_ORDER[b.profile] !== undefined ? Math.abs(PROFILE_ORDER[b.profile] - profileRank) : 0;
        if (ar !== br) return ar - br;
        const roleRank = { reasoning: 0, coding: 1, vision: 2, rerank: 3, embedding: 4, ocr: 5 };
        const rr = (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9);
        if (rr !== 0) return rr;
        if (a.vramGb !== b.vramGb) return a.vramGb - b.vramGb;
        return String(a.modelKey).localeCompare(String(b.modelKey));
      });
  }

  // Select model for a task, considering availability, capability, profile, latency/benchmark.
  selectForTask(taskType, { profile = sovereign.hardwareProfile, onlyAvailable = null } = {}) {
    const required = TASK_REQUIREMENTS[taskType] || [CAPABILITIES.TEXT_GENERATION];
    const preferredRole = ROLE_BY_TASK[taskType] || 'reasoning';
    const matches = this.matchCapabilities(required, { profile, availableOnly: true });
    if (matches.length > 0) {
      // Prefer the model whose role matches the task role.
      const roleMatch = matches.find(m => m.role === preferredRole);
      const chosen = roleMatch || matches[0];
      return { entry: chosen, role: chosen.role, modelId: resolveModelId(chosen.modelKey), modelKey: chosen.modelKey, available: true };
    }
    // Availability forcing: include configured-but-not-yet-available entries for reporting.
    const all = this.matchCapabilities(required, { profile, availableOnly: false });
    const nearest = all[0] || this.bestForRole(preferredRole, profile);
    const avail = nearest && nearest.status === 'available';
    return { entry: nearest, role: preferredRole, modelId: nearest ? resolveModelId(nearest.modelKey) : null, modelKey: nearest?.modelKey || null, available: avail };
  }

  describe(taskType) {
    const role = ROLE_BY_TASK[taskType] || 'reasoning';
    const entry = this.bestForRole(role);
    return { taskType, role, modelKey: entry.modelKey, modelId: resolveModelId(entry.modelKey), status: entry.status };
  }
}

const _registry = new ModelRegistry();
export const modelRegistry = _registry;