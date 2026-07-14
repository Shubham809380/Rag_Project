import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const LOG = 'EmbeddingService';

const EMBED_MODEL = 'gemini-embedding-001';
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

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
    _model = getGenAI().getGenerativeModel({ model: EMBED_MODEL });
  }
  return _model;
}

function isRetryable(err) {
  const status = err.status || err.statusCode || 0;
  if (RETRYABLE_STATUSES.has(status)) return true;
  const msg = err.message || '';
  if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed')) return true;
  return false;
}

function extractErrorDetails(err) {
  const status = err.status || err.statusCode || 0;
  const statusText = err.statusText || '';
  const message = err.message || 'unknown error';
  const errorDetails = err.errorDetails || null;
  let responseBody = null;
  if (errorDetails) {
    try { responseBody = JSON.stringify(errorDetails).substring(0, 500); } catch {}
  }
  return { status, statusText, message, errorDetails, responseBody };
}

function validateVector(vector, chunkIndex, expectedDimension) {
  if (!Array.isArray(vector)) {
    return { valid: false, reason: `Chunk ${chunkIndex}: vector is not an array (got ${typeof vector})` };
  }
  if (vector.length === 0) {
    return { valid: false, reason: `Chunk ${chunkIndex}: vector is empty` };
  }
  for (let i = 0; i < vector.length; i++) {
    if (typeof vector[i] !== 'number' || isNaN(vector[i])) {
      return { valid: false, reason: `Chunk ${chunkIndex}: vector contains non-number at index ${i} (got ${typeof vector[i]})` };
    }
  }
  if (expectedDimension && vector.length !== expectedDimension) {
    return { valid: false, reason: `Chunk ${chunkIndex}: dimension mismatch - got ${vector.length}, expected ${expectedDimension}` };
  }
  return { valid: true, dimension: vector.length };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function embedSingle(text, { retries = MAX_RETRIES, taskType = null, label = 'single' } = {}) {
  const start = Date.now();
  const model = getModel();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const request = {
        content: { role: 'user', parts: [{ text }] },
      };
      if (taskType) {
        request.taskType = taskType;
      }

      const result = await model.embedContent(request);
      const values = result.embedding?.values;

      if (!values || !Array.isArray(values) || values.length === 0) {
        throw new Error('Empty or invalid embedding vector returned from API');
      }

      for (let i = 0; i < values.length; i++) {
        if (typeof values[i] !== 'number' || isNaN(values[i])) {
          throw new Error(`Invalid vector value at index ${i}: ${typeof values[i]}`);
        }
      }

      const elapsed = Date.now() - start;
      logger.debug(LOG, `[${label}] Embed OK (${elapsed}ms, ${values.length}d, attempt ${attempt})`);
      return { success: true, vector: values, dimension: values.length, duration: elapsed };
    } catch (err) {
      const elapsed = Date.now() - start;
      const details = extractErrorDetails(err);
      const retryable = isRetryable(err);

      logger.error(LOG, `[${label}] Embed FAILED attempt ${attempt}/${retries}`, {
        status: details.status,
        statusText: details.statusText,
        model: EMBED_MODEL,
        taskType: taskType || 'none',
        error: details.message.substring(0, 300),
        responseBody: details.responseBody,
        retryable,
        duration: elapsed,
      });

      if (attempt === retries || !retryable) {
        return {
          success: false,
          error: details.message,
          status: details.status,
          statusText: details.statusText,
          responseBody: details.responseBody,
          model: EMBED_MODEL,
          duration: elapsed,
        };
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 15000);
      logger.warn(LOG, `[${label}] Retry ${attempt}/${retries} in ${Math.round(delay)}ms`, { status: details.status });
      await sleep(delay);
    }
  }
}

export async function embedTexts(texts, { label = 'batch', taskType = null, onProgress } = {}) {
  const start = Date.now();
  const results = [];
  let totalSuccess = 0;
  let totalFailed = 0;
  const expectedDim = getExpectedDimension();

  logger.info(LOG, `[${label}] Starting sequential embedding of ${texts.length} texts`, { taskType: taskType || 'none', expectedDim });

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const chunkLabel = `${label}-chunk-${i}`;

    if (!text || text.trim().length < 5) {
      logger.warn(LOG, `[${chunkLabel}] Skipped - text too short (${text?.length || 0} chars)`);
      results.push(null);
      totalFailed++;
      continue;
    }

    const embedResult = await embedSingle(text, { retries: MAX_RETRIES, taskType, label: chunkLabel });

    if (embedResult.success) {
      const validation = validateVector(embedResult.vector, i, expectedDim);
      if (!validation.valid) {
        logger.error(LOG, `[${chunkLabel}] Vector validation FAILED`, { reason: validation.reason });
        results.push(null);
        totalFailed++;
      } else {
        results.push(embedResult.vector);
        totalSuccess++;
      }
    } else {
      results.push(null);
      totalFailed++;
    }

    if ((i + 1) % 10 === 0 || i === texts.length - 1) {
      logger.info(LOG, `[${label}] Progress: ${i + 1}/${texts.length} (ok=${totalSuccess}, fail=${totalFailed})`);
    }

    onProgress?.({ processed: i + 1, total: texts.length, success: totalSuccess, failed: totalFailed });

    if (i < texts.length - 1) {
      await sleep(100);
    }
  }

  const dim = results.find(v => v !== null)?.length || 0;
  const totalElapsed = Date.now() - start;

  logger.info(LOG, `[${label}] Complete: ${totalSuccess}/${texts.length} success, ${totalFailed} failed, dim=${dim} (${totalElapsed}ms)`);

  if (dim > 0 && expectedDim > 0 && dim !== expectedDim) {
    logger.error(LOG, `[${label}] DIMENSION MISMATCH`, {
      embeddingDimension: dim,
      expectedDimension: expectedDim,
      pineconeNote: 'Pinecone index must be recreated with matching dimension',
    });
  }

  return { results, totalSuccess, totalFailed, dimension: dim, duration: totalElapsed };
}

export function getExpectedDimension() {
  return 3072;
}

export async function healthCheck() {
  const start = Date.now();
  try {
    const result = await embedSingle('embedding health check', {
      retries: 2,
      taskType: TaskType.RETRIEVAL_QUERY,
      label: 'health-check',
    });
    const elapsed = Date.now() - start;
    if (result.success) {
      return {
        success: true,
        model: EMBED_MODEL,
        dimensions: result.dimension,
        duration: elapsed,
      };
    }
    return {
      success: false,
      model: EMBED_MODEL,
      error: result.error,
      status: result.status,
      duration: elapsed,
    };
  } catch (err) {
    const elapsed = Date.now() - start;
    return {
      success: false,
      model: EMBED_MODEL,
      error: err.message,
      duration: elapsed,
    };
  }
}

export async function validateApiKey() {
  return healthCheck();
}
