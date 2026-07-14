import { Router } from 'express';
import config from '../config/index.js';
import * as embeddingService from '../services/embedding.service.js';
import * as pineconeService from '../services/pinecone.service.js';
import logger from '../utils/logger.js';

const router = Router();
const LOG = 'DebugRoutes';

router.get('/ping', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health', async (_req, res) => {
  const checks = { status: 'ok', timestamp: new Date().toISOString(), services: {} };

  try {
    const result = await embeddingService.healthCheck();
    if (result.success) {
      checks.services.embedding = { status: 'ok', model: result.model, dimension: result.dimensions, duration: result.duration };
    } else {
      checks.services.embedding = { status: 'error', model: result.model, error: result.error, status: result.status, duration: result.duration };
      checks.status = 'degraded';
    }
  } catch (err) {
    checks.services.embedding = { status: 'error', error: err.message };
    checks.status = 'degraded';
  }

  try {
    const stats = await pineconeService.verifyIndex();
    if (stats.valid) {
      checks.services.pinecone = {
        status: 'ok',
        totalVectors: stats.stats?.totalVectorCount || 0,
        dimension: stats.stats?.dimension || 0,
        namespaces: Object.keys(stats.stats?.namespaces || {}).length,
      };
    } else {
      checks.services.pinecone = { status: 'error', error: stats.error };
      checks.status = 'degraded';
    }
  } catch (err) {
    checks.services.pinecone = { status: 'error', error: err.message };
    checks.status = 'degraded';
  }

  const httpStatus = checks.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(checks);
});

router.get('/health/embedding', async (_req, res) => {
  try {
    const result = await embeddingService.healthCheck();
    if (result.success) {
      res.json({
        success: true,
        model: result.model,
        dimensions: result.dimensions,
        duration: result.duration,
      });
    } else {
      res.status(500).json({
        success: false,
        model: result.model,
        error: result.error,
        status: result.status || null,
        duration: result.duration,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      model: 'gemini-embedding-001',
      error: error.message,
    });
  }
});

router.get('/embedding', async (_req, res) => {
  try {
    const result = await embeddingService.healthCheck();
    res.json({
      ...result,
      env: {
        hasGeminiKey: Boolean(config.gemini.apiKey),
        embedModel: config.gemini.embedModel,
        expectedDimension: embeddingService.getExpectedDimension(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pinecone', async (_req, res) => {
  try {
    const stats = await pineconeService.verifyIndex();
    if (stats.valid) {
      res.json(stats.stats);
    } else {
      res.status(500).json({ success: false, error: stats.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
