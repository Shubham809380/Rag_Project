import { Router } from 'express';
import config from '../config/index.js';
import * as authController from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.get('/google', authController.googleAuth);
router.get('/google/callback', (req, res, next) => authController.googleCallback(req, res, next));
router.get('/debug', (_req, res) => {
  res.json({
    googleConfigured: Boolean(config.auth.googleClientId && config.auth.googleClientSecret),
    frontendUrl: config.auth.frontendUrl,
    backendUrl: config.auth.backendUrl,
    callbackUrl: config.auth.callbackUrl,
    isProduction: config.isProduction,
    isVercel: config.isVercel,
    hasJwtSecret: Boolean(config.auth.jwtSecret),
  });
});
router.get('/me', authenticateToken, authController.getMe);
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);

export default router;
