import { Router } from 'express';
import * as settings from '../controllers/settings.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken);

router.get('/', settings.getSettings);
router.put('/', settings.updateSettings);

export default router;
