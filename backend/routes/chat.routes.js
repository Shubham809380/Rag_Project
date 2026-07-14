import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import config from '../config/index.js';
import * as chatController from '../controllers/chat.controller.js';
import * as documentController from '../controllers/document.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Upload (mounted at / so full path is /api/upload)
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
router.post('/upload', authenticateToken, uploadLimiter, uploadMultiple, documentController.uploadDocuments);

// Analyze
router.post('/analyze', authenticateToken, chatController.analyze);

// Conversations
router.get('/conversations', authenticateToken, chatController.getConversations);
router.post('/conversations', authenticateToken, chatController.createConversation);
router.put('/conversations/:id', authenticateToken, chatController.updateConversation);
router.delete('/conversations/:id', authenticateToken, chatController.deleteConversation);
router.get('/conversations/:id/messages', authenticateToken, chatController.getMessages);

// History
router.get('/history', authenticateToken, chatController.getHistory);

export default router;
