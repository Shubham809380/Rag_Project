import sovereign from '../config/sovereign.js';
import logger from '../utils/logger.js';

const LOG = 'LocalProvider';

// ─────────────────────────────────────────────────────────────────────────────
// LocalModelProvider
//
// Talks to a LOCAL inference gateway over plain HTTP on loopback:
//   * Ollama    → native /api/chat, /api/embed(ding), /api/tags, /api/ps
//   * vLLM      → OpenAI-compatible /v1/chat/completions, /v1/embeddings, /v1/models
//
// This provider NEVER leaves the machine; network egress is controlled by the
// sovereignty monitor (loopback always allowed, everything else policy-gated).
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sovereign.provider.apiKey || 'EMPTY'}` };

function isOpenAICompat() { return sovereign.provider.openaiCompat; }

async function requestJson(url, { method = 'GET', body, timeoutMs = sovereign.provider.timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: DEFAULT_HEADERS,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Local gateway HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeChatMessages(messages, images, openaiCompat) {
  const out = [];
  for (const m of messages || []) {
    let content = m.content;
    if (typeof content !== 'string') content = String(content ?? '');
    out.push({ role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user', content });
  }
  if (images && images.length) {
    let last = out.length ? out[out.length - 1] : { role: 'user', content: '' };
    if (last.role !== 'user') { out.push({ role: 'user', content: '' }); last = out[out.length - 1]; }
    if (openaiCompat) {
      // OpenAI-compatible multimodal: content array with image_url data-URIs.
      last.content = [{ type: 'text', text: String(last.content) }];
      for (const img of images) {
        last.content.push({ type: 'image_url', image_url: { url: typeof img === 'string' ? img : `data:${img.mime};base64,${img.base64}` } });
      }
    } else {
      // Ollama NATIVE /api/chat: content stays a string; images go on the
      // user message as an array of raw base64 (no data: prefix).
      last.images = (last.images || []).concat(images.map(img => {
        if (typeof img === 'string') {
          const comma = img.indexOf(',');
          return comma > 0 && /^data:[^,]+;base64$/i.test(img.slice(0, comma)) ? img.slice(comma + 1) : img;
        }
        return img.base64;
      }));
    }
  }
  return out;
}

function runModelTracking(fn) {
  return async (...args) => {
    let monitor = null;
    try { const mod = await import('../monitor/monitor.js'); monitor = mod.default?.() || null; } catch { /* monitor optional */ }
    const start = Date.now();
    try {
      const result = await fn(...args);
      monitor?.recordLocalModelCall({ provider: 'local', detail: { model: result?.model || args[0]?.model || 'unknown' }, durationMs: Date.now() - start });
      return result;
    } catch (err) {
      monitor?.recordLocalModelCall({ provider: 'local', success: false, detail: { error: err.message } });
      throw err;
    }
  };
}

class LocalModelProvider {
  constructor({ baseUrl = sovereign.provider.baseUrl, openaiCompat = sovereign.provider.openaiCompat } = {}) {
    this.name = 'local';
    this.kind = 'local';
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.openaiCompat = openaiCompat;
  }

  endpoint() { return this.openaiCompat ? `${this.baseUrl}/v1` : this.baseUrl; }

  async isAvailable() {
    const start = Date.now();
    try {
      const url = this.openaiCompat ? `${this.endpoint()}/models` : `${this.baseUrl}/api/tags`;
      const res = await fetch(url, { headers: DEFAULT_HEADERS, signal: AbortSignal.timeout(4000) });
      if (!res.ok) return { available: false, detail: `HTTP ${res.status}`, latencyMs: Date.now() - start };
      await res.json();
      return { available: true, detail: 'reachable', latencyMs: Date.now() - start };
    } catch (err) {
      return { available: false, detail: err.message, latencyMs: Date.now() - start };
    }
  }

  async listModels() {
    try {
      const url = this.openaiCompat ? `${this.endpoint()}/models` : `${this.baseUrl}/api/tags`;
      const json = await requestJson(url);
      if (this.openaiCompat) return (json.data || []).map(m => ({ id: m.id, name: m.id, size: m.size || 0 }));
      return (json.models || []).map(m => ({ id: m.name, name: m.model || m.name, size: m.size || 0, details: { family: m.details?.family || '', quantization: m.details?.quantization_level || '' } }));
    } catch (err) {
      logger.warn(LOG, 'listModels failed', { error: err.message });
      return [];
    }
  }

  // Is this model currently resident in the gateway (loaded into memory)?
  // Used to decide whether a heavy model can answer without a slow swap-in.
  async isWarm(model) {
    try {
      if (this.openaiCompat) return false; // no standard residency probe
      const json = await requestJson(`${this.baseUrl}/api/ps`, { timeoutMs: 4000 });
      const list = json.models || [];
      const norm = s => String(s || '').trim();
      return list.some(m => norm(m.name) === norm(model) || norm(m.model) === norm(model));
    } catch {
      // If the probe fails, optimistically allow the LLM attempt.
      return true;
    }
  }

  async chat({ model, messages, temperature = 0.2, images, tools, think } = {}) {
    return runModelTracking(async ({ model, messages, temperature, images, tools, think }) => {
      // Heavy local models can take tens of seconds to swap into memory; during
      // that window Ollama may drop the connection. Retry ONCE on transient
      // network-level failures (load/reset/timeout) before surfacing the error.
      const attempt = async (retriesLeft) => {
        try {
          return await this._chatOnce({ model, messages, temperature, images, tools, think });
        } catch (err) {
          const transient = /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|abort|read\s*(ECONNRESET)?/i.test(err?.message || '');
          if (!transient || retriesLeft <= 0) throw err;
          logger.warn(LOG, `transient gateway error on ${model}, retrying`, { error: err.message, retriesLeft });
          await new Promise(r => setTimeout(r, 2500));
          return attempt(retriesLeft - 1);
        }
      };
      return attempt(1);
    })({ model, messages, temperature, images, tools, think });
  }

  async _chatOnce({ model, messages, temperature = 0.2, images, tools, think }) {
    const start = Date.now();
    const normalized = normalizeChatMessages(messages, images, this.openaiCompat);
    let content;
    let tokens = null;
    if (this.openaiCompat) {
      const payload = { model, messages: normalized, temperature, stream: false };
      if (tools && tools.length) payload.tools = tools;
      const json = await requestJson(`${this.endpoint()}/chat/completions`, { method: 'POST', body: payload });
      content = json.choices?.[0]?.message?.content ?? '';
      tokens = { input: json.usage?.prompt_tokens, output: json.usage?.completion_tokens };
    } else {
      const payload = { model, messages: normalized, stream: false, options: { temperature, ...(think === undefined ? {} : { think }) } };
      if (tools && tools.length) payload.tools = tools;
      // Multimodal: move images to Ollama's native format on the last user message.
      const json = await requestJson(`${this.baseUrl}/api/chat`, { method: 'POST', body: payload });
      content = json.message?.content ?? '';
      tokens = typeof json.prompt_eval_count === 'number' ? { input: json.prompt_eval_count, output: json.eval_count } : null;
    }
    return { content: String(content), model, durationMs: Date.now() - start, tokens, provider: 'local' };
  }

  async embed({ model, texts }) {
    return runModelTracking(async ({ model, texts }) => {
      const start = Date.now();
      const list = Array.isArray(texts) ? texts : [texts];
      if (this.openaiCompat) {
        const json = await requestJson(`${this.endpoint()}/embeddings`, { method: 'POST', body: { model, input: list } });
        const vectors = (json.data || []).sort((a, b) => a.index - b.index).map(d => d.embedding);
        return { vectors, dimension: vectors[0]?.length || 0, model, durationMs: Date.now() - start, provider: 'local' };
      }
      // Ollama: prefer /api/embed (multi-input), fall back to /api/embeddings (single).
      try {
        const json = await requestJson(`${this.baseUrl}/api/embed`, { method: 'POST', body: { model, input: list } });
        const raw = json.embeddings || [];
        const vectors = Array.isArray(raw[0]) ? raw : (list.length === 1 && raw.length ? [[raw]] : raw);
        const flat = vectors.map(v => (Array.isArray(v) ? v : [v]));
        const out = [];
        for (let i = 0; i < list.length; i++) out.push(flat[i] || flat[0] || []);
        return { vectors: out, dimension: out[0]?.length || 0, model, durationMs: Date.now() - start, provider: 'local' };
      } catch (e) {
        if (!/HTTP \d+/.test(e.message)) throw e;
      }
      const vectors = [];
      for (const text of list) {
        const json = await requestJson(`${this.baseUrl}/api/embeddings`, { method: 'POST', body: { model, prompt: text } });
        vectors.push(json.embedding || []);
      }
      return { vectors, dimension: vectors[0]?.length || 0, model, durationMs: Date.now() - start, provider: 'local' };
    })({ model, texts });
  }

  async modelExists(model) {
    const models = await this.listModels();
    return models.some(m => m.id === model);
  }
}

export default LocalModelProvider;