import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticateToken, isAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/stats', authenticateToken, isAdmin, adminController.getStats);
router.get('/users', authenticateToken, isAdmin, adminController.getUsers);
router.get('/visits', authenticateToken, isAdmin, adminController.getVisits);
router.get('/visits/stats', authenticateToken, isAdmin, adminController.getVisitStats);
router.put('/users/:id/role', authenticateToken, isAdmin, adminController.updateRole);
// Hardening: migrate previously had NO auth — any unauthenticated client could
// trigger schema migrations. Now admin-only. Unauthenticated → 401; user → 403.
router.get('/migrate', authenticateToken, isAdmin, adminController.runMigration);

export default router;
