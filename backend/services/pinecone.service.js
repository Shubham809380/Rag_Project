import { Pinecone } from '@pinecone-database/pinecone';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const LOG = 'PineconeService';

let _client = null;
let _index = null;

export function getClient() {
  if (!_client) {
    if (!config.pinecone.apiKey) {
      throw new Error('PINECONE_API_KEY is not configured');
    }
    _client = new Pinecone({ apiKey: config.pinecone.apiKey });
    logger.info(LOG, 'Pinecone client initialized');
  }
  return _client;
}

export function getIndex() {
  if (!_index) {
    const client = getClient();
    const host = config.pinecone.host || undefined;
    _index = client.Index(config.pinecone.indexName, host);
    logger.info(LOG, `Pinecone index connected: ${config.pinecone.indexName}`);
  }
  return _index;
}

export async function verifyIndex() {
  try {
    const index = getIndex();
    const stats = await index.describeIndexStats();
    logger.info(LOG, 'Index verified', {
      totalVectors: stats.totalVectorCount,
      dimension: stats.dimension,
      namespaces: Object.keys(stats.namespaces || {}).length,
    });
    return { valid: true, stats };
  } catch (err) {
    logger.error(LOG, 'Index verification failed', { error: err.message });
    return { valid: false, error: err.message };
  }
}

export async function upsertVectors(records, { label = 'default' } = {}) {
  if (!records || records.length === 0) {
    logger.warn(LOG, `[${label}] No records to upsert`);
    return { upserted: 0 };
  }

  const start = Date.now();
  const index = getIndex();
  const batchSize = config.pipeline.pineconeUpsertBatch;
  let totalUpserted = 0;

  logger.info(LOG, `[${label}] Upserting ${records.length} vectors in batches of ${batchSize}`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(records.length / batchSize);

    try {
      await withRetry(
        () => index.upsert({ records: batch }),
        { label: `upsert-${batchNum}`, maxRetries: 3, baseDelay: 2000 }
      );
      totalUpserted += batch.length;
      logger.debug(LOG, `[${label}] Batch ${batchNum}/${totalBatches} upserted (${batch.length} vectors)`);
    } catch (err) {
      logger.error(LOG, `[${label}] Batch ${batchNum}/${totalBatches} FAILED`, { error: err.message });
      for (const record of batch) {
        try {
          await index.upsert({ records: [record] });
          totalUpserted++;
        } catch (singleErr) {
          logger.error(LOG, `[${label}] Individual upsert failed for ${record.id}`, { error: singleErr.message });
        }
      }
    }
  }

  const elapsed = Date.now() - start;
  logger.info(LOG, `[${label}] Upsert complete: ${totalUpserted}/${records.length} vectors (${elapsed}ms)`);
  return { upserted: totalUpserted, duration: elapsed };
}

export async function queryVectors(vector, { topK, filter, includeMetadata = true } = {}) {
  const start = Date.now();
  const index = getIndex();

  try {
    const response = await withRetry(
      () => index.query({
        vector,
        topK: topK || config.pipeline.queryTopK,
        includeMetadata,
        filter: filter || {},
      }),
      { label: 'query', maxRetries: 2, baseDelay: 1000 }
    );

    const elapsed = Date.now() - start;
    const matches = response.matches || [];
    logger.info(LOG, `Query returned ${matches.length} matches (${elapsed}ms)`);
    return { matches, duration: elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    logger.error(LOG, 'Query failed', { error: err.message, duration: elapsed });
    throw err;
  }
}

export async function deleteByFilter(filter, { label = 'default' } = {}) {
  try {
    const index = getIndex();
    await index.deleteMany({ filter });
    logger.info(LOG, `[${label}] Deleted vectors by filter`);
  } catch (err) {
    logger.error(LOG, `[${label}] Delete failed`, { error: err.message });
  }
}

async function withRetry(fn, { label = 'operation', maxRetries = 3, baseDelay = 1000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const status = err.status || err.statusCode || 0;
      const isRetryable = status === 429 || status === 503 || status === 500 ||
        (err.message && (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT')));
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500, 15000);
      logger.warn(LOG, `[${label}] Retry ${attempt}/${maxRetries} in ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}
