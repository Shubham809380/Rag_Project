import { Router } from 'express';
import {
  sovereignOptionalAuth,
  sovereignRequireAuth,
  sovereignAdminOnly,
} from '../security/sovereignAuth.js';
import {
  login,
  logout,
  me,
  authStatus,
  changePassword,
  register,
  listUsers,
  createEmployee,
  updateUser,
  resetEmployeePassword,
} from '../controllers/sovereignAuth.controller.js';

const router = Router();

// Public-ish (optional identity handshake)
router.get('/sovereign/auth/status', sovereignOptionalAuth, authStatus);

// Auth
router.post('/sovereign/auth/login', login);
router.post('/sovereign/auth/register', register);
router.post('/sovereign/auth/logout', sovereignRequireAuth, logout);
router.get('/sovereign/auth/me', sovereignRequireAuth, me);
router.post('/sovereign/auth/change-password', sovereignRequireAuth, changePassword);

// Admin user management (requires admin role)
router.get('/sovereign/admin/users', sovereignRequireAuth, sovereignAdminOnly, listUsers);
router.post('/sovereign/admin/users', sovereignRequireAuth, sovereignAdminOnly, createEmployee);
router.put('/sovereign/admin/users/:id', sovereignRequireAuth, sovereignAdminOnly, updateUser);
router.post('/sovereign/admin/users/:id/reset-password', sovereignRequireAuth, sovereignAdminOnly, resetEmployeePassword);

export default router;