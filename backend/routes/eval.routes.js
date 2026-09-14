import { Router } from 'express';
import * as evalController from '../controllers/eval.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken);

router.post('/run', evalController.runEval);
router.get('/history/:scope', evalController.getEvalHistory);

export default router;
