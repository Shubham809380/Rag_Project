import { Router } from 'express';
import * as analytics from '../controllers/analytics.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken);

router.get('/', analytics.getUserAnalytics);
router.get('/sessions', analytics.getSessionAnalytics);

export default router;
