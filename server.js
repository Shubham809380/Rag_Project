import express from 'express';
import multer from 'multer';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import pool from './backend/db.js';
import {
  buildAuthConfig,
  clearAuthCookie,
  configurePassport,
  createAuthenticateToken,
  createAuthRouter,
  getRequestToken,
  setAuthCookie,
} from './backend/routes/authRoutes.js';

// Lazy-loaded heavy modules (loaded on first use, not at cold start)
let _pipelineModule = null;
async function getPipeline() {
  if (!_pipelineModule) {
    _pipelineModule = await import('./backend/rag/pipeline.js');
  }
  return _pipelineModule;
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isVercel = !!process.env.VERCEL;
const authConfig = buildAuthConfig(process.env);

if (!authConfig.jwtSecret) {
  if (isVercel) {
    console.error('[FATAL] JWT_SECRET is not set. Auth will be broken. Set JWT_SECRET in Vercel env vars.');
  } else {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    process.exit(1);
  }
}

if (!authConfig.googleClientId || !authConfig.googleClientSecret) {
  console.warn('[WARN] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google OAuth will not work.');
}

app.set('trust proxy', 1);

app.use(cookieParser());
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = [authConfig.frontendUrl];

  if (isVercel && process.env.VERCEL_URL) {
    const vercelUrl = `https://${process.env.VERCEL_URL}`;
    if (!allowedOrigins.includes(vercelUrl)) {
      allowedOrigins.push(vercelUrl);
    }
  }

  const origin = requestOrigin || '';
  const isAllowed = !origin || allowedOrigins.includes(origin);

  if (isAllowed) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());
app.use(passport.initialize());

// Auto-migration on startup (skip on Vercel - run via /api/admin/migrate instead)
let migrationDone = true;
const migrationPromise = isVercel ? Promise.resolve() : (async () => {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        email VARCHAR(255),
        page VARCHAR(500) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        referrer TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_visits_user_id ON page_visits(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON page_visits(created_at)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        login_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        logout_at TIMESTAMPTZ,
        ip_address VARCHAR(45),
        user_agent TEXT
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
    console.log('Auto-migration completed');
  } catch (err) {
    console.error('Auto-migration error:', err.message);
  } finally {
    migrationDone = true;
  }
})();

app.get('/api/admin/migrate', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        email VARCHAR(255),
        page VARCHAR(500) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        referrer TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_visits_user_id ON page_visits(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON page_visits(created_at)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        login_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        logout_at TIMESTAMPTZ,
        ip_address VARCHAR(45),
        user_agent TEXT
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
    migrationDone = true;
    res.json({ message: 'Migration completed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

try {
  configurePassport(passport, pool, authConfig);
  console.log('[auth] Passport configured successfully');
} catch (err) {
  console.error('[auth] Failed to configure Passport:', err.message);
}

// Auth middleware
const authenticateToken = createAuthenticateToken(authConfig);


function optionalAuth(req, res, next) {
  const token = getRequestToken(req, authConfig);
  if (token) {
    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret);
      req.user = decoded;
    } catch {}
  }
  next();
}

async function isAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch {
    return res.status(403).json({ message: 'Admin access required' });
  }
}

// ==================== AUTH ROUTES ====================

const authRoutes = createAuthRouter({ authConfig, authenticateToken, passport, pool });
app.use('/api/auth', authRoutes);
console.log('[auth] Auth routes mounted at /api/auth');

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const isAdminEmail = email.toLowerCase() === authConfig.adminEmail;
    let result;
    try {
      result = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, auth_provider, email_verified, role, last_login_at)
         VALUES ($1, $2, $3, 'email', false, $4, CURRENT_TIMESTAMP)
         RETURNING id, full_name, email, avatar_url, role, created_at`,
        [name.trim(), email.toLowerCase(), passwordHash, isAdminEmail ? 'admin' : 'user']
      );
    } catch (roleErr) {
      result = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, auth_provider, email_verified, last_login_at)
         VALUES ($1, $2, $3, 'email', false, CURRENT_TIMESTAMP)
         RETURNING id, full_name, email, avatar_url, created_at`,
        [name.trim(), email.toLowerCase(), passwordHash]
      );
      if (result.rows[0]) {
        result.rows[0].role = isAdminEmail ? 'admin' : 'user';
      }
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.full_name },
      authConfig.jwtSecret,
      { expiresIn: '7d' }
    );
    setAuthCookie(res, token, authConfig);
    res.status(201).json({ user });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    let result;
    try {
      result = await pool.query(
        'SELECT id, full_name, email, avatar_url, password_hash, role, created_at FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
    } catch (roleErr) {
      result = await pool.query(
        'SELECT id, full_name, email, avatar_url, password_hash, created_at FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      if (result.rows[0]) {
        result.rows[0].role = 'user';
      }
    }
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ message: 'This account uses Google sign-in. Please use "Continue with Google".' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.full_name },
      authConfig.jwtSecret,
      { expiresIn: '7d' }
    );
    setAuthCookie(res, token, authConfig);
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Login failed' });
  }
});

// ==================== CONVERSATIONS ====================

app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
       FROM conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get conversations error:', error.message);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;
    const result = await pool.query(
      `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at`,
      [req.user.id, title || 'New Chat']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create conversation error:', error.message);
    res.status(500).json({ message: 'Failed to create conversation' });
  }
});

app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;
    const result = await pool.query(
      `UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 RETURNING id, title, updated_at`,
      [title, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Conversation not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update conversation error:', error.message);
    res.status(500).json({ message: 'Failed to update conversation' });
  }
});

app.delete('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error.message);
    res.status(500).json({ message: 'Failed to delete conversation' });
  }
});

app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conv = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (conv.rows.length === 0) return res.status(404).json({ message: 'Conversation not found' });

    const result = await pool.query(
      `SELECT id, role, message, metadata, created_at FROM chat_messages
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [req.params.id, req.user.id]
    );

    const messages = result.rows.map(m => {
      const meta = m.metadata || {};
      return {
        id: m.id,
        role: m.role,
        content: m.message,
        created_at: m.created_at,
        sources: meta.sources || [],
        confidence: meta.confidence || null,
        followUps: meta.followUps || [],
        model: meta.model || null,
      };
    });
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error.message);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// ==================== DOCUMENTS ====================

app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, pinecone_file_id, file_name, chunk_count, created_at
       FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get documents error:', error.message);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, pinecone_file_id, file_name FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Document not found' });

    const doc = result.rows[0];

    try {
      const pipeline = await getPipeline();
      const pineconeIndex = pipeline.getPineconeIndex();
      await pineconeIndex.deleteMany({ filter: { fileId: doc.pinecone_file_id } });
      console.log(`[DELETE] Pinecone vectors deleted for ${doc.file_name}`);
    } catch (pineErr) {
      console.error('[DELETE] Pinecone delete error:', pineErr.message);
    }

    await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete document error:', error.message);
    res.status(500).json({ message: 'Failed to delete document' });
  }
});

// ==================== USER PROFILE ====================

app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, avatar_url, auth_provider, created_at, last_login_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) return res.status(400).json({ message: 'Name is required' });
    const result = await pool.query(
      `UPDATE users SET full_name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING id, full_name, email, avatar_url`,
      [full_name.trim(), req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    const [docs, conversations, messages] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM documents WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*) as count FROM conversations WHERE user_id = $1', [req.user.id]),
      pool.query("SELECT COUNT(*) as count FROM chat_messages WHERE user_id = $1 AND role = 'user'", [req.user.id]),
    ]);
    res.json({
      documents: parseInt(docs.rows[0].count),
      conversations: parseInt(conversations.rows[0].count),
      questionsAsked: parseInt(messages.rows[0].count),
    });
  } catch (error) {
    console.error('Get stats error:', error.message);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

app.delete('/api/user/account', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    clearAuthCookie(res, authConfig);
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error.message);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

// ==================== FILE UPLOAD & ANALYSIS ====================

const uploadsDir = isVercel ? '/tmp' : path.join(__dirname, 'uploads');
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, TXT, CSV files are allowed'));
    }
  },
});

const uploadMultiple = upload.array('files', 10);

if (!isVercel && !fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

app.post('/api/upload', authenticateToken, (req, res) => {
  uploadMultiple(req, res, async (err) => {
    const uploadStart = Date.now();
    try {
      if (err) {
        return res.status(400).json({ message: 'Upload error: ' + err.message });
      }

      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const pipeline = await getPipeline();
      const results = [];
      for (const file of files) {
        console.log(`\n[UPLOAD] Processing: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`);
        const fileStart = Date.now();

        let result;
        try {
          result = await pipeline.ingestDocument(file, req.user);
        } catch (ingestErr) {
          console.error(`[UPLOAD] Ingest failed for ${file.originalname}:`, ingestErr.message);
          try { fs.unlinkSync(file.path); } catch {}
          results.push({
            fileId: null,
            fileName: file.originalname,
            pages: 0,
            chunks: 0,
            error: ingestErr.message,
          });
          continue;
        }

        const fileElapsed = Date.now() - fileStart;
        console.log(`[UPLOAD] Done: ${file.originalname} - ${result.chunks} chunks in ${fileElapsed}ms`);

        if (!result.chunks || result.chunks === 0) {
          console.warn(`[UPLOAD] WARNING: 0 chunks for ${file.originalname}. Document NOT saved to DB.`);
          try { fs.unlinkSync(file.path); } catch {}
          results.push({
            fileId: result.fileId,
            fileName: result.fileName,
            pages: result.pages,
            chunks: 0,
            error: result.error || 'No readable text could be extracted from this document.',
          });
          continue;
        }

        try {
          await pool.query(
            `INSERT INTO documents (user_id, pinecone_file_id, file_name, chunk_count)
             VALUES ($1, $2, $3, $4)`,
            [req.user.id, result.fileId, result.fileName, result.chunks]
          );
          console.log(`[UPLOAD] Saved to DB: ${result.fileName} (${result.chunks} chunks)`);
        } catch (dbErr) {
          console.error('[UPLOAD] Failed to save document to DB:', dbErr.message);
        }

        results.push(result);
      }

      const totalElapsed = Date.now() - uploadStart;
      const successCount = results.filter(r => r.chunks > 0).length;
      const failCount = results.filter(r => r.chunks === 0).length;

      console.log(`\n[UPLOAD] COMPLETE: ${successCount} succeeded, ${failCount} failed in ${totalElapsed}ms`);

      res.json({
        files: results,
        message: failCount > 0
          ? `${successCount} document(s) uploaded. ${failCount} failed (no readable text extracted).`
          : `${results.length} document(s) uploaded and indexed successfully`,
      });
    } catch (error) {
      console.error('[UPLOAD] Fatal error:', error.message);
      res.status(500).json({ message: 'Failed to process document: ' + error.message });
    }
  });
});

// ==================== ANALYZE (MULTI-TURN) ====================

app.post('/api/analyze', authenticateToken, async (req, res) => {
  const requestStart = Date.now();
  try {
    const { question, fileId, conversationId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Question is required' });
    }

    console.log(`\n=== ANALYZE: "${question}" | user=${req.user.id} | fileId=${fileId || 'all'} ===`);

    const authTime = Date.now();
    console.log(`  [TIMING] Auth: ${authTime - requestStart}ms`);

    let convId = conversationId;

    if (!convId) {
      const title = question.length > 60 ? question.substring(0, 60) + '...' : question;
      const convResult = await pool.query(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
        [req.user.id, title]
      );
      convId = convResult.rows[0].id;
    }

    await pool.query(
      `INSERT INTO chat_messages (user_id, conversation_id, role, message) VALUES ($1, $2, 'user', $3)`,
      [req.user.id, convId, question]
    );
    await pool.query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [convId]
    );

    const dbTime = Date.now();
    console.log(`  [TIMING] DB writes: ${dbTime - authTime}ms`);

    // Pre-query validation: check if document has chunks before running expensive pipeline
    if (fileId) {
      const docCheck = await pool.query(
        'SELECT id, file_name, chunk_count FROM documents WHERE pinecone_file_id = $1 AND user_id = $2',
        [fileId, req.user.id]
      );
      if (docCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found.',
        });
      }
      const doc = docCheck.rows[0];
      if (!doc.chunk_count || doc.chunk_count === 0) {
        return res.status(400).json({
          success: false,
          code: 'DOCUMENT_NOT_PROCESSED',
          message: `Document "${doc.file_name}" has not been processed successfully (0 chunks). Please upload it again.`,
        });
      }
      console.log(`  [VALIDATE] Document "${doc.file_name}" has ${doc.chunk_count} chunks - OK`);
    }

    // Get conversation history for multi-turn context
    const historyResult = await pool.query(
      `SELECT role, message FROM chat_messages
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [convId, req.user.id]
    );
    const previousMessages = historyResult.rows.slice(0, -1);

    const histTime = Date.now();
    console.log(`  [TIMING] History fetch: ${histTime - dbTime}ms`);

    // Run the RAG pipeline (lazy-loaded)
    const pipeline = await getPipeline();
    const loadTime = Date.now();
    console.log(`  [TIMING] Pipeline module load: ${loadTime - histTime}ms`);

    const result = await pipeline.queryPipeline({
      question: question.trim(),
      fileId: fileId || null,
      userId: req.user.id,
      conversationId: convId,
      previousMessages,
    });

    const pipelineTime = Date.now();
    console.log(`  [TIMING] Pipeline total: ${pipelineTime - loadTime}ms`);

    // Save assistant response with metadata (sources, confidence, followUps, model)
    const assistantMetadata = JSON.stringify({
      sources: result.sources || [],
      confidence: result.confidence || null,
      followUps: result.followUps || [],
      model: result.model || null,
    });
    await pool.query(
      `INSERT INTO chat_messages (user_id, conversation_id, role, message, metadata) VALUES ($1, $2, 'assistant', $3, $4)`,
      [req.user.id, convId, result.answer, assistantMetadata]
    );

    // Update conversation title if first message
    if (previousMessages.length === 0) {
      const shortTitle = question.length > 60 ? question.substring(0, 60) + '...' : question;
      await pool.query(
        'UPDATE conversations SET title = $1 WHERE id = $2',
        [shortTitle, convId]
      );
    }

    const totalTime = Date.now() - requestStart;
    console.log(`  [TIMING] TOTAL: ${totalTime}ms | model=${result.model} | confidence=${result.confidence}`);
    console.log(`=== ANSWER READY ===\n`);

    res.json(result);
  } catch (error) {
    const totalTime = Date.now() - requestStart;
    console.error(`[ANALYZE] Error after ${totalTime}ms:`, error.message);
    console.error(error.stack);

    let userMessage = 'Analysis failed: ' + error.message;
    let statusCode = 500;

    if (error.message && error.message.includes('Pipeline timeout')) {
      userMessage = 'The AI service took too long to respond. Please try a shorter question or try again later.';
      statusCode = 504;
    } else if (error.message && error.message.includes('ECONNRESET')) {
      userMessage = 'Connection lost. Please try again.';
    } else if (error.message && error.message.includes('ETIMEDOUT')) {
      userMessage = 'Connection timed out. Please try again.';
    } else if (error.status === 429 || (error.message && error.message.includes('429'))) {
      userMessage = 'AI service is rate-limited. Please try again in a moment.';
    }

    res.status(statusCode).json({
      success: false,
      code: statusCode === 504 ? 'AI_SERVICE_TIMEOUT' : 'ANALYSIS_FAILED',
      message: userMessage,
    });
  }
});

// ==================== VISIT TRACKING ====================

app.post('/api/track-visit', optionalAuth, async (req, res) => {
  try {
    const { page } = req.body;
    if (!page) return res.json({ ok: true });
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';
    const userId = req.user?.id || null;
    const email = req.user?.email || null;
    await pool.query(
      'INSERT INTO page_visits (user_id, email, page, ip_address, user_agent, referrer) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, email, page, ip, ua, referrer]
    );
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// ==================== ADMIN ROUTES ====================

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [users, docs, convs, msgs, visits, todayVisits, uniqueVisitors] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM documents'),
      pool.query('SELECT COUNT(*) as count FROM conversations'),
      pool.query("SELECT COUNT(*) as count FROM chat_messages WHERE role = 'user'"),
      pool.query('SELECT COUNT(*) as count FROM page_visits'),
      pool.query("SELECT COUNT(*) as count FROM page_visits WHERE created_at >= CURRENT_DATE"),
      pool.query("SELECT COUNT(DISTINCT COALESCE(user_id::text, ip_address)) as count FROM page_visits"),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalDocuments: parseInt(docs.rows[0].count),
      totalConversations: parseInt(convs.rows[0].count),
      totalQuestions: parseInt(msgs.rows[0].count),
      totalVisits: parseInt(visits.rows[0].count),
      todayVisits: parseInt(todayVisits.rows[0].count),
      uniqueVisitors: parseInt(uniqueVisitors.rows[0].count),
    });
  } catch (error) {
    console.error('Admin stats error:', error.message);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.role, u.auth_provider,
              u.email_verified, u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM documents WHERE user_id = u.id) as doc_count,
              (SELECT COUNT(*) FROM conversations WHERE user_id = u.id) as conv_count,
              (SELECT COUNT(*) FROM chat_messages WHERE user_id = u.id AND role = 'user') as question_count
       FROM users u ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin users error:', error.message);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

app.get('/api/admin/visits', authenticateToken, isAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const result = await pool.query(
      `SELECT pv.id, pv.email, pv.page, pv.ip_address, pv.user_agent, pv.created_at,
              u.full_name
       FROM page_visits pv
       LEFT JOIN users u ON pv.user_id = u.id
       ORDER BY pv.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin visits error:', error.message);
    res.status(500).json({ message: 'Failed to fetch visits' });
  }
});

app.get('/api/admin/visits/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as visits
       FROM page_visits
       WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin visit stats error:', error.message);
    res.status(500).json({ message: 'Failed to fetch visit stats' });
  }
});

app.put('/api/admin/users/:id/role', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role',
      [role, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Admin role update error:', error.message);
    res.status(500).json({ message: 'Failed to update role' });
  }
});

app.get('/api/debug', async (req, res) => {
  try {
    const pipeline = await getPipeline();
    const pineconeIndex = pipeline.getPineconeIndex();
    const stats = await pineconeIndex.describeIndexStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/auth/debug', (req, res) => {
  res.json({
    googleConfigured: Boolean(authConfig.googleClientId && authConfig.googleClientSecret),
    frontendUrl: authConfig.frontendUrl,
    backendUrl: authConfig.backendUrl,
    callbackUrl: authConfig.callbackUrl,
    isProduction: authConfig.isProduction,
    isVercel,
    vercelUrl: process.env.VERCEL_URL || null,
    hasJwtSecret: Boolean(authConfig.jwtSecret),
  });
});

// Serve frontend build
const frontendBuild = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(frontendBuild, 'index.html'));
    }
    next();
  });
}

// Error handler
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: 'File upload error: ' + err.message });
  }
  res.status(500).json({ message: err.message || 'Internal server error' });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

if (!isVercel) {
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  GET  /api/auth/google         - Google OAuth login`);
    console.log(`  GET  /api/auth/google/callback - Google OAuth callback`);
    console.log(`  GET  /api/auth/me             - Get current user`);
    console.log(`  POST /api/auth/logout          - Logout`);
    console.log(`  POST /api/upload               - Upload & index document`);
    console.log(`  POST /api/analyze              - Ask question about document`);
    console.log(`  GET  /api/history              - Get analysis history`);
    console.log(`  GET  /api/debug                - Check Pinecone data`);
    console.log(`  GET  /api/health               - Health check`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Kill the other process or use a different port.`);
    } else {
      console.error('Server error:', err.message);
    }
  });
}

export { app };


