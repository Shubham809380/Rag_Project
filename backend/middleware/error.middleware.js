import multer from 'multer';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const LOG = 'ErrorHandler';

export function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File too large. Maximum size is ${config.upload.maxFileSize / 1024 / 1024}MB`
      : `Upload error: ${err.message}`;
    return res.status(400).json({ success: false, stage: 'upload', message, retryable: false });
  }

  if (err.message?.includes('Unsupported file format')) {
    return res.status(400).json({
      success: false, stage: 'validation', message: err.message,
      retryable: false,
    });
  }

  if (err.message?.includes('Pipeline timeout')) {
    return res.status(504).json({
      success: false, stage: 'pipeline', message: 'The AI service took too long. Please try a shorter question.',
      retryable: true,
    });
  }

  const status = err.status || err.statusCode || 500;
  const isRetryable = status >= 500;

  logger.error(LOG, `Unhandled error [${status}]`, {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack?.substring(0, 300) : undefined,
  });

  res.status(status).json({
    success: false,
    stage: 'server',
    message: status === 500 ? 'Internal server error' : err.message,
    retryable: isRetryable,
  });
}

export function uncaughtHandlers() {
  process.on('unhandledRejection', (reason) => {
    logger.error(LOG, 'Unhandled Rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error(LOG, 'Uncaught Exception', { message: err.message });
  });
}
