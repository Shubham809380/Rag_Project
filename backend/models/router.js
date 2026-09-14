import sovereign from '../config/sovereign.js';
import { modelRegistry as registry } from './registry.js';
import { classifier } from './classifier.js';
import { getLocalProvider } from '../providers/index.js';
import { resolveModelId } from './registry.js';
import { CAPABILITIES } from './capabilities.js';
import logger from '../utils/logger.js';

const LOG = 'ModelRouter';

// ─────────────────────────────────────────────────────────────────────────────
// ModelRouter — the SINGLE decision point for "which local model runs this".
//
// Pipeline:  classify → select (registry) → enforce policy → invoke.
// Policy:    local/air-gap mode uses the local provider ONLY.
//            If no local model can handle the task, we say so explicitly.
//            Native fallback to cloud NEVER happens from this module.
// ─────────────────────────────────────────────────────────────────────────────

export const UNAVAILABLE_MESSAGE = 'Local verification is insufficient for this task. No local model with the required capability is available. Human review is required.';

export class ModelRouter {
  constructor() {
    this.registry = registry;
    this.provider = getLocalProvider();
  }

  async classify(input) {
    return classifier.classify(input);
  }

  // Decide the model for a task. Returns a decision object.
  async decide({ question, taskType, modality, images = [] , profile = sovereign.hardwareProfile }) {
    if (!taskType) {
      const c = classifier.classify({ question, images });
      taskType = c.taskType;
      modality = c.modality;
    }
    try { await this.registry.syncFromProvider(); } catch { /* best-effort availability refresh */ }
    const summary = this.registry.describe(taskType);
    const decision = this.registry.selectForTask(taskType, { profile });

    const requiredCaps = decision.entry?.capabilities || [];
    // Vision tasks may additionally require the vision capability.
    let capabilityOk = true;
    if (taskType === 'vision' || taskType === 'ocr') {
      capabilityOk = requiredCaps.includes(CAPABILITIES.VISION);
    }
    // SOVEREIGN_MODEL_ALLOWLIST: when configured, any model id not on the list
    // is refused — an explicit, audited boundary above and beyond availability.
    let allowlistOk = true;
    if (decision.modelId && sovereign.model.allowlist.length) {
      allowlistOk = sovereign.model.allowlist.includes(String(decision.modelId).toLowerCase());
    }

    let unavailableReason = null;
    if (!decision.modelId) unavailableReason = 'No model registered for this task role.';
    else if (!decision.available) unavailableReason = `Model "${decision.modelKey}" is not available on the local gateway.`;
    else if (!capabilityOk) unavailableReason = `Model "${decision.modelKey}" lacks the required capability for ${taskType}.`;
    else if (!allowlistOk) unavailableReason = `Model "${decision.modelId}" is not on the SOVEREIGN_MODEL_ALLOWLIST.`;

    const routed = decision.available && capabilityOk && allowlistOk;
    const runtime = 'Ollama (local)';
    const network = sovereign.isLocal ? 'LOCAL ONLY' : 'online-domain (egress guard still active)';
    const reason = routed
      ? `Task '${taskType}' routed to local model "${decision.modelId}" (role=${decision.role}, status=${decision.entry?.status}, profile=${profile}).`
      : `Task '${taskType}' NOT routable: ${unavailableReason || 'capability/profile mismatch'}`;

    // Requirement: log every model-selection decision (TASK CLASSIFICATION).
    logger.info(LOG, 'TASK CLASSIFICATION', {
      task: taskType,
      modality: modality || (images?.length ? 'multimodal' : 'text'),
      selectedModel: decision.modelId || null,
      runtime,
      network,
      available: routed,
      reason,
    });

    return {
      taskType,
      modality,
      decisionModelKey: decision.modelKey,
      decisionModelId: decision.modelId,
      decisionRole: decision.role,
      decisionStatus: decision.entry?.status || 'configured',
      decisionCapabilities: requiredCaps,
      available: routed,
      reason,
      unavailableReason,
      runtime,
      network,
      profile,
      mode: sovereign.mode,
    };
  }

  // Resolve and invoke a chat generation through the local provider.
  async generate({ question, messages, taskType, images, temperature = 0.2, profile, think } = {}) {
    let decision = await this.decide({ question, taskType, images, profile });
    // A slot marked DEGRADED (one recent failure) is worth one retry: heavy local
    // models often fail a single call during a model-swap and then work fine.
    if (!decision.available && decision.decisionStatus === 'degraded' && decision.decisionModelKey) {
      logger.warn(LOG, `Retrying degraded slot ${decision.decisionModelKey} (transient failure window)`);
      this.registry.clearFailures(decision.decisionModelKey);
      decision = await this.decide({ question, taskType, images, profile });
    }
    if (!decision.available || !decision.decisionModelId) {
      logger.warn(LOG, `Generation blocked: no local model for ${decision.taskType}`, { reason: decision.unavailableReason });
      return { decision, ok: false, content: null, message: decision.unavailableReason || UNAVAILABLE_MESSAGE };
    }
    const msgs = messages || (question ? [{ role: 'user', content: question }] : []);
    const model = decision.decisionModelId;
    try {
      const result = await this.provider.chat({ model, messages: msgs, temperature, images, think });
      this.registry.clearFailures(decision.decisionModelKey);
      logger.info(LOG, `Local inference: ${model} → ${result.content?.length ?? 0} chars in ${result.durationMs}ms`);
      return { decision, ok: true, content: result.content, durationMs: result.durationMs, model, tokens: result.tokens || null };
    } catch (err) {
      this.registry.markModelFailure(decision.decisionModelKey, err.message);
      logger.error(LOG, `Local inference failed on ${model}`, { error: err.message });
      return { decision, ok: false, content: null, message: `Local inference failed: ${err.message}`, error: err };
    }
  }

  // Embed via the highest-fidelity LOCAL embedding capability available.
  async embedTexts(texts, { model } = {}) {
    try { await this.registry.syncFromProvider(); } catch { /* best-effort availability refresh */ }
    const embedEntry = this.registry.bestForRole('embedding', sovereign.hardwareProfile);
    const modelId = model || resolveModelId(embedEntry.modelKey);
    const matches = this.registry.matchCapabilities([CAPABILITIES.EMBEDDING], { availableOnly: true });
    if (matches.length === 0) {
      return { ok: false, reason: `No local embedding model available (expected "${modelId}").`, modelKey: embedEntry.modelKey };
    }
    try {
      const r = await this.provider.embed({ model: modelId, texts });
      if (r.dimension === 0) return { ok: false, reason: `Embedding model "${modelId}" returned empty vectors.`, modelKey: embedEntry.modelKey };
      this.registry.clearFailures(embedEntry.modelKey);
      return { ok: true, vectors: r.vectors, dimension: r.dimension, modelKey: embedEntry.modelKey, modelId };
    } catch (err) {
      this.registry.markModelFailure(embedEntry.modelKey, err.message);
      return { ok: false, reason: `Local embedding failed on "${modelId}": ${err.message}`, modelKey: embedEntry.modelKey };
    }
  }

  getStatus() {
    return {
      mode: sovereign.mode,
      gateway: sovereign.provider.baseUrl,
      openaiCompat: sovereign.provider.openaiCompat,
      hardwareProfile: sovereign.hardwareProfile,
    };
  }
}

let _router = null;
export const modelRouter = () => (_router || (_router = new ModelRouter()));