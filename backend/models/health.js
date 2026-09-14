import { getLocalProvider, getCloudProvider } from '../providers/index.js';
import sovereign from '../config/sovereign.js';
import logger from '../utils/logger.js';

const LOG = 'ModelHealth';

// Checks gateway reachability + per-model presence/latency without cloud.
export class ModelHealthChecker {
  constructor() { this._cache = { ts: 0, data: null }; }

  async gatewayHealth() {
    const local = getLocalProvider();
    const cloud = getCloudProvider();
    const [lh, ch] = await Promise.all([
      local.isAvailable(),
      (sovereign.isLocal ? Promise.resolve({ available: false, detail: 'disabled in local mode' }) : cloud.isAvailable()),
    ]);
    return {
      local: lh,
      cloud: ch,
      mode: sovereign.mode,
      timestamp: new Date().toISOString(),
    };
  }

  async refresh({ force = false } = {}) {
    if (!force && this._cache.data && Date.now() - this._cache.ts < 30000) return this._cache.data;
    const gh = await this.gatewayHealth();
    this._cache = { ts: Date.now(), data: gh };
    return gh;
  }

  async modelPresence(modelKey, modelId) {
    const local = getLocalProvider();
    if (!modelId) return { exists: false, latencyMs: null };
    const t0 = Date.now();
    try {
      // A 1-token chat round-trip measures latency and confirms loadability.
      const r = await local.chat({ model: modelId, messages: [{ role: 'user', content: 'ping' }], temperature: 0 });
      return { exists: true, latencyMs: Date.now() - t0, contentLen: r.content?.length };
    } catch (err) {
      return { exists: false, latencyMs: Date.now() - t0, error: err.message };
    }
  }
}

let _instance = null;
export const healthChecker = () => (_instance || (_instance = new ModelHealthChecker()));