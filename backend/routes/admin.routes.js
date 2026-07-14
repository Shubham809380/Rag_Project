import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticateToken, isAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/stats', authenticateToken, isAdmin, adminController.getStats);
router.get('/users', authenticateToken, isAdmin, adminController.getUsers);
router.get('/visits', authenticateToken, isAdmin, adminController.getVisits);
router.get('/visits/stats', authenticateToken, isAdmin, adminController.getVisitStats);
router.put('/users/:id/role', authenticateToken, isAdmin, adminController.updateRole);
router.get('/migrate', adminController.runMigration);

export default router;
