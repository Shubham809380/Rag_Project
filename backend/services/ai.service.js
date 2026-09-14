import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { modelRouter } from '../models/router.js';
import sovereign from '../config/sovereign.js';

const LOG = 'AIService';
const _clients = {};

function getModel(modelName) {
  const name = modelName || config.gemini.llmModels[0];
  if (!_clients[name]) {
    _clients[name] = new GeneralAIClient(name);
  }
  return _clients[name];
}

// Wrapper abstracting the two Gemini SDKs (langchain chat + raw generative)
class GeneralAIClient {
  constructor(modelName) {
    this.modelName = modelName;
    this.chat = new ChatGoogleGenerativeAI({
      apiKey: config.gemini.apiKey,
      model: modelName,
      temperature: config.gemini.temperature,
      maxRetries: 0,
      timeout: 60000,
    });
    this.raw = new GoogleGenerativeAI(config.gemini.apiKey).getGenerativeModel({ model: modelName });
  }

  async invoke(messages, { temperature } = {}) {
    let msgs = messages;
    if (typeof messages === 'string') {
      msgs = [{ role: 'user', content: messages }];
    }
    // normalize {role:'system'} → Gemini "system" is handled by langchain wrapper
    const model = this.chat;
    if (temperature != null) {
      return model.invoke(msgs, { temperature });
    }
    return model.invoke(msgs);
  }

  async invokeRaw(contents, { temperature } = {}) {
    const gen = this.chat;
    const msgs = (typeof contents === 'string')
      ? [{ role: 'user', content: contents }]
      : (Array.isArray(contents) ? contents.map(c => ({ role: c.role || 'user', content: typeof c === 'string' ? c : (c.content || c.text || '') })) : [{ role: 'user', content: String(contents) }]);
    const result = await gen.invoke(msgs, temperature != null ? { temperature } : undefined);
    return result.content;
  }

  async stream(messages, { onToken, temperature, signal } = {}) {
    return this.chat.stream(messages, {
      temperature,
      signal,
    });
  }
}

// Generate a text completion with model fallback. Returns { content, model, duration } or null.
export async function generate(messages, { models, temperature } = {}) {
  const start = Date.now();

  // Sovereign air-gap mode: generation goes through the local ModelRouter ONLY.
  // No cloud fallback ever. If no local model can handle it, we say so explicitly.
  if (sovereign.mode === 'local') {
    const q = Array.isArray(messages) ? messages.map(m => m.content || '').filter(Boolean).join('\n') : String(messages || '');
    const res = await modelRouter().generate({ question: q, messages, temperature });
    if (res.ok) return { content: res.content, model: res.model, duration: res.durationMs || Date.now() - start };
    logger.warn(LOG, `local-mode generate blocked`, { reason: res.message });
    return null;
  }

  const candidateModels = models || config.gemini.llmModels;
  for (const modelName of candidateModels) {
    try {
      const client = getModel(modelName);
      const response = await client.invoke(messages, { temperature });
      return { content: response.content, model: modelName, duration: Date.now() - start };
    } catch (err) {
      logger.warn(LOG, `generate ${modelName} failed`, { error: err.message?.substring(0, 150) });
    }
  }
  return null;
}

// Return raw text (works with a plain string prompt too)
export async function generateText(prompt, { models, temperature } = {}) {
  const res = await generate([{ role: 'user', content: prompt }], { models, temperature });
  if (!res) return null;
  return res.content;
}

// Generate and reliably parse JSON (handles markdown code fences).
export async function generateJSON(messages, { models, temperature } = {}) {
  const result = await generate(messages, { models, temperature });
  if (!result) return { content: null, model: null, duration: 0, json: null };
  const text = result.content || '';
  let json = null;
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const target = fenced ? fenced[1] : text;
    json = JSON.parse(target.trim());
  } catch (e) {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        json = JSON.parse(text.slice(start, end + 1));
      }
    } catch (e2) {
      logger.warn(LOG, 'generateJSON parse failed', { error: e2.message });
    }
  }
  return { content: text, model: result.model, duration: result.duration, json };
}

// Streaming helper. Invokes onToken with partial text. Returns full text.
export async function stream(messages, { onToken, models, temperature, signal } = {}) {
  const start = Date.now();
  const candidateModels = models || config.gemini.llmModels;
  let lastErr = null;
  for (const modelName of candidateModels) {
    try {
      const client = getModel(modelName);
      const stream_ = await client.stream(messages, { temperature, signal });
      let full = '';
      for await (const chunk of stream_) {
        const piece = chunk?.content ?? chunk?.text ?? '';
        if (piece) {
          full += piece;
          onToken?.(piece, full, modelName);
        }
      }
      return { content: full, model: modelName, duration: Date.now() - start };
    } catch (err) {
      lastErr = err;
      logger.warn(LOG, `stream ${modelName} failed`, { error: err.message?.substring(0, 150) });
      // If explicitly aborted, stop trying lower models
      if (err?.name === 'AbortError' || signal?.aborted) throw err;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

export function getAvailableModels() {
  if (sovereign.mode === 'local') {
    const available = modelRouter().registry.matchCapabilities([], { availableOnly: true }).map(m => m.modelKey);
    return available.length > 0 ? available : ['(no local models available)'];
  }
  return config.gemini.llmModels;
}
