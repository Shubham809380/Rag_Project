import { Router } from 'express';
import * as kbController from '../controllers/knowledgebase.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', kbController.listKnowledgeBases);
router.post('/', kbController.createKnowledgeBase);
router.get('/:id/stats', kbController.getKbStats);
router.put('/:id', kbController.updateKnowledgeBase);
router.delete('/:id', kbController.deleteKnowledgeBase);

export default router;
