import { Router } from 'express';
import config from '../config/index.js';
import * as embeddingService from '../services/embedding.service.js';
import * as pineconeService from '../services/pinecone.service.js';
import logger from '../utils/logger.js';

const router = Router();
const LOG = 'DebugRoutes';

router.get('/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health', async (_req, res) => {
  const checks = { status: 'ok', timestamp: new Date().toISOString(), services: {} };

  try {
    const result = await embeddingService.embedSingleText('Health check');
    checks.services.embedding = { status: 'ok', dimension: result.dimension, model: result.model };
  } catch (err) {
    checks.services.embedding = { status: 'error', error: err.message };
    checks.status = 'degraded';
  }

  try {
    const stats = await pineconeService.getIndexStats();
    checks.services.pinecone = {
      status: 'ok', totalVectors: stats.totalVectors || 0, dimension: stats.dimension || 0,
    };
  } catch (err) {
    checks.services.pinecone = { status: 'error', error: err.message };
    checks.status = 'degraded';
  }

  res.json(checks);
});

router.get('/embedding', async (_req, res) => {
  try {
    const result = await embeddingService.embedSingleText('Embedding health check');
    res.json({ ...result, env: { hasGeminiKey: Boolean(config.gemini.apiKey), embedModel: config.gemini.embedModel } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pinecone', async (_req, res) => {
  try {
    const stats = await pineconeService.getIndexStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
