import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import config from '../config/index.js';

export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => ipKeyGenerator(req),
});

export const uploadLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.uploadMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads. Please try again later.' },
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please try again later.' },
  keyGenerator: (req) => ipKeyGenerator(req),
});
