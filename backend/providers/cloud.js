import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import config from '../config/index.js';
import sovereign from '../config/sovereign.js';
import logger from '../utils/logger.js';

const LOG = 'CloudProvider';

// ─────────────────────────────────────────────────────────────────────────────
// CloudProvider (Gemini) — BUILD/STAGING DOMAIN ONLY.
//
// This provider is NEVER resolved in sovereign/local mode. The model router
// enforces that. Keeping it here preserves the existing online Sovereign AI Workbench path
// so the app remains functional in the internet-connected staging fleet.
// ─────────────────────────────────────────────────────────────────────────────

const _clients = {};

function client(model) {
  if (!_clients[model]) {
    _clients[model] = new ChatGoogleGenerativeAI({
      apiKey: config.gemini.apiKey,
      model,
      temperature: config.gemini.temperature,
      maxRetries: 1,
      timeout: 60000,
    });
  }
  return _clients[model];
}

class CloudProvider {
  constructor() { this.name = 'gemini'; this.kind = 'cloud'; }

  isEnabled() { return config.gemini.enabled && !sovereign.isLocal; }

  async isAvailable() {
    if (!this.isEnabled()) return { available: false, detail: 'disabled in sovereign/local mode' };
    const start = Date.now();
    try {
      await client(config.gemini.llmModels[0]).invoke([{ role: 'user', content: 'hi' }]);
      return { available: true, detail: 'reachable', latencyMs: Date.now() - start };
    } catch (err) {
      return { available: false, detail: err.message, latencyMs: Date.now() - start };
    }
  }

  async chat({ model, messages, temperature } = {}) {
    const start = Date.now();
    const name = model || config.gemini.llmModels[0];
    const msgs = (messages || []).map(m => ({ role: m.role || 'user', content: m.content || '' }));
    const res = await client(name).invoke(msgs, temperature != null ? { temperature } : undefined);
    return { content: String(res.content ?? ''), model: name || res.response_metadata?.modelName, durationMs: Date.now() - start, provider: 'gemini' };
  }

  async embed({ model, texts }) {
    const start = Date.now();
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const m = genAI.getGenerativeModel({ model: model || config.gemini.embedModel || 'gemini-embedding-001' });
    const list = Array.isArray(texts) ? texts : [texts];
    const vectors = [];
    for (const text of list) {
      const r = await m.embedContent({ content: { role: 'user', parts: [{ text }] }, taskType: TaskType.RETRIEVAL_DOCUMENT });
      vectors.push(r.embedding?.values || []);
    }
    return { vectors, dimension: vectors[0]?.length || 0, model: model || 'gemini-embedding-001', durationMs: Date.now() - start, provider: 'gemini' };
  }

  async listModels() {
    return config.gemini.llmModels.map(id => ({ id, name: id, size: 0 }));
  }
}

function sovereignLocal() {
  try { return global.__SOVEREIGN_LOCAL__; } catch { return false; }
}

export { client as getGeminiClient };
export default CloudProvider;