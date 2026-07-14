import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import config from '../config/index.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import * as documentController from '../controllers/document.controller.js';

const router = Router();

const upload = multer({
  dest: config.upload.tempDir || path.join(process.cwd(), 'uploads'),
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.upload.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${ext}. Allowed: ${config.upload.allowedExtensions.join(', ')}`));
    }
  },
});

const uploadMultiple = upload.array('files', config.upload.maxFiles);

// GET /api/documents → list
router.get('/', authenticateToken, documentController.getDocuments);

// DELETE /api/documents/:id → delete
router.delete('/:id', authenticateToken, documentController.deleteDocument);

export default router;
