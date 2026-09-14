// Provider contract — every provider implements this interface.
// Providers are the ONLY way the application talks to a model backend.
export const ProviderInterface = {
  name: 'abstract',
  kind: 'local' | 'cloud',
  async isAvailable() {},          // → { available, detail, latencyMs }
  async chat({ model, messages, temperature, format, images }) {}, // → { content, model, durationMs, tokens }
  async embed({ model, texts }) {}, // → { vectors, dimension, model, durationMs }
  async listModels() {},            // → [{ id, name, size? }]
};

export function ensureMessages(messages, text) {
  if (typeof messages === 'string') return [{ role: 'user', content: messages }];
  if (!Array.isArray(messages)) return [{ role: 'user', content: String(text ?? messages) }];
  return messages;
}