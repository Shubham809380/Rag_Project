import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const LOG = 'LLMService';

let _clients = {};

function getClient(modelName) {
  if (!_clients[modelName]) {
    _clients[modelName] = new ChatGoogleGenerativeAI({
      apiKey: config.gemini.apiKey,
      model: modelName,
      temperature: config.gemini.temperature,
      maxRetries: 0,
      timeout: 60000,
    });
  }
  return _clients[modelName];
}

export async function generateResponse(messages, { models } = {}) {
  const candidateModels = models || config.gemini.llmModels;
  const start = Date.now();

  for (const modelName of candidateModels) {
    const modelStart = Date.now();
    try {
      logger.info(LOG, `Trying ${modelName}`, { timeout: 60 });
      const client = getClient(modelName);
      const response = await client.invoke(messages);
      const elapsed = Date.now() - modelStart;
      logger.info(LOG, `Response from ${modelName} (${elapsed}ms)`, { contentLength: response.content?.length || 0 });
      return { content: response.content, model: modelName, duration: elapsed };
    } catch (err) {
      const elapsed = Date.now() - modelStart;
      const status = err.status || err.statusCode || 0;
      logger.warn(LOG, `Model ${modelName} failed`, { status, duration: elapsed, error: err.message?.substring(0, 150) });
    }
  }

  const totalElapsed = Date.now() - start;
  logger.error(LOG, `All models failed after ${totalElapsed}ms`);
  return null;
}
