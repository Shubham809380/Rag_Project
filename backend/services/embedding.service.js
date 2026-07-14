import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const LOG = 'EmbeddingService';

let _genAI = null;
let _model = null;

function getGenAI() {
  if (!_genAI) {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    _genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return _genAI;
}

function getModel() {
  if (!_model) {
    _model = getGenAI().getGenerativeModel({ model: config.gemini.embedModel });
  }
  return _model;
}

export async function validateApiKey() {
  try {
    const result = await embedSingle('health check');
    if (result.success) {
      logger.info(LOG, 'API key validated successfully', { dimension: result.dimension });
      return { valid: true, dimension: result.dimension };
    }
    logger.error(LOG, 'API key validation failed', { error: result.error });
    return { valid: false, error: result.error };
  } catch (err) {
    logger.error(LOG, 'API key validation error', { error: err.message });
    return { valid: false, error: err.message };
  }
}

export async function embedSingle(text, { retries = 3 } = {}) {
  const start = Date.now();
  const model = getModel();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.embedContent(text);
      const values = result.embedding?.values;
      if (!values || values.length === 0) {
        throw new Error('Empty embedding vector returned');
      }
      const elapsed = Date.now() - start;
      logger.debug(LOG, `Single embed OK (${elapsed}ms, ${values.length}d)`);
      return { success: true, vector: values, dimension: values.length, duration: elapsed };
    } catch (err) {
      const status = err.status || err.statusCode || 0;
      const elapsed = Date.now() - start;
      const isRetryable = status === 429 || status === 503 || status === 500 || status === 0;

      if (attempt === retries || !isRetryable) {
        logger.error(LOG, `Single embed FAILED after ${attempt} attempt(s)`, {
          status, error: err.message?.substring(0, 200), duration: elapsed,
        });
        return { success: false, error: err.message, status, duration: elapsed };
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 15000);
      logger.warn(LOG, `Single embed retry ${attempt}/${retries}`, { status, delayMs: Math.round(delay) });
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

export async function embedTexts(texts, { label = 'batch', onProgress } = {}) {
  const start = Date.now();
  const model = getModel();
  const results = [];
  const batchSize = config.pipeline.embedBatchSize;
  let totalSuccess = 0;
  let totalFailed = 0;

  logger.info(LOG, `[${label}] Starting embedding of ${texts.length} texts`, { batchSize });

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(texts.length / batchSize);
    const batchLabel = `${label}-${batchNum}`;
    const batchStart = Date.now();

    let batchSuccess = 0;
    let batchFailed = 0;

    for (let j = 0; j < batch.length; j++) {
      const text = batch[j];
      const textIndex = i + j;

      if (!text || text.trim().length < 5) {
        results.push(null);
        batchFailed++;
        totalFailed++;
        continue;
      }

      const embedResult = await embedSingle(text, { retries: 3 });
      if (embedResult.success) {
        results.push(embedResult.vector);
        batchSuccess++;
        totalSuccess++;
      } else {
        results.push(null);
        batchFailed++;
        totalFailed++;
      }
    }

    const batchElapsed = Date.now() - batchStart;
    logger.info(LOG, `[${label}] Batch ${batchNum}/${totalBatches}: ${batchSuccess} ok, ${batchFailed} fail (${batchElapsed}ms)`);
    onProgress?.({ processed: Math.min(i + batchSize, texts.length), total: texts.length, batchNum, totalBatches });
  }

  const totalElapsed = Date.now() - start;
  const dim = results.find(v => v !== null)?.length || 0;
  logger.info(LOG, `[${label}] Complete: ${totalSuccess}/${texts.length} success, ${totalFailed} failed, dim=${dim} (${totalElapsed}ms)`);

  return { results, totalSuccess, totalFailed, dimension: dim, duration: totalElapsed };
}

export function getExpectedDimension() {
  return config.gemini.embedModel === 'gemini-embedding-001' ? 3072 : 768;
}
