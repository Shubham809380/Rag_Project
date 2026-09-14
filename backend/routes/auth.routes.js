import { Router } from 'express';
import config from '../config/index.js';
import * as authController from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.get('/google', authController.googleAuth);
router.get('/google/callback', (req, res, next) => authController.googleCallback(req, res, next));
router.get('/debug', (_req, res) => {
  // Hardening: this endpoint previously leaked config URLs/flags unauthenticated.
  // In production it is disabled entirely. In development it returns NON-sensitive
  // booleans only — never URLs, origins, callback routes or key presence.
  if (config.isProduction) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  res.json({
    googleConfigured: Boolean(config.auth.googleClientId && config.auth.googleClientSecret),
    isProduction: config.isProduction,
    isRender: config.isRender,
    env: 'development',
  });
});
router.get('/me', authenticateToken, authController.getMe);
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/verify-reset-token', authLimiter, authController.verifyResetToken);
router.post('/reset-password', authLimiter, authController.resetPassword);

export default router;
