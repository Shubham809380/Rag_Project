import { Router } from 'express';
import authRoutes from './auth.routes.js';
import chatRoutes from './chat.routes.js';
import documentRoutes from './document.routes.js';
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';
import trackingRoutes from './tracking.routes.js';
import debugRoutes from './debug.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);
router.use('/debug', debugRoutes);
router.use('/', trackingRoutes);     // /track-visit

router.use('/documents', documentRoutes);   // /documents, /documents/:id
router.use('/', chatRoutes);                // /upload, /analyze, /conversations, /history

export default router;
