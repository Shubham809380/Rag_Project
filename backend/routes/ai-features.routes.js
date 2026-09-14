import { Router } from 'express';
import multer from 'multer';
import * as ai from '../controllers/ai-features.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken);

const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Summary
router.get('/summary/types', ai.listSummaryTypes);
router.post('/summary', ai.summarize);

// Research mode
router.post('/research', ai.research);
router.get('/research', ai.getResearchHistory);
router.get('/research/:id', ai.getResearch);
router.delete('/research/:id', ai.deleteResearch);

// Agentic RAG
router.post('/agent', ai.agentChat);

// Compare
router.post('/compare', ai.compare);

// Study mode
router.post('/study', ai.study);
router.post('/study/quiz/submit', ai.submitQuiz);
router.get('/study/quiz/results', ai.getQuizResults);

// Voice
router.get('/voice/capabilities', ai.voiceCapabilities);
router.post('/voice/transcribe', audioUpload.single('audio'), ai.transcribe);
router.post('/voice/synthesize', ai.synthesize);

// Export
router.post('/export', ai.exportContent);

// Feedback
router.post('/feedback/rate', ai.rateMessage);
router.post('/feedback/clear', ai.clearRating);

// Models
router.get('/models', ai.availableModels);

export default router;
