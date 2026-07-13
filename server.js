import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import pool from './backend/db.js';
import { ingestDocument, getPineconeIndex, queryPipeline } from './backend/rag/pipeline.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isVercel = !!process.env.VERCEL;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'patrashubhamm031@gmail.com';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}
const COOKIE_NAME = 'auth_token';

app.use(cookieParser());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(passport.initialize());

// Auto-migration on startup
let migrationDone = false;
const migrationPromise = (async () => {
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

// Passport setup
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `${BACKEND_URL}/api/auth/google/callback`,
    scope: ['profile', 'email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value;
      const fullName = profile.displayName;
      const avatarUrl = profile.photos?.[0]?.value || null;
      const emailVerified = profile.emails?.[0]?.verified || false;

      if (!email) {
        return done(new Error('No email found from Google account'), null);
      }

      const isAdminUser = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      let result;
      try {
        result = await pool.query(
          `INSERT INTO users (google_id, full_name, email, avatar_url, email_verified, role, last_login_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (google_id) DO UPDATE SET
             full_name = EXCLUDED.full_name,
             email = EXCLUDED.email,
             avatar_url = EXCLUDED.avatar_url,
             email_verified = EXCLUDED.email_verified,
             role = CASE WHEN ${isAdminUser} THEN 'admin' ELSE users.role END,
             updated_at = CURRENT_TIMESTAMP,
             last_login_at = CURRENT_TIMESTAMP
           RETURNING id, google_id, full_name, email, avatar_url, role`,
          [googleId, fullName, email, avatarUrl, emailVerified, isAdminUser ? 'admin' : 'user']
        );
      } catch (roleErr) {
        result = await pool.query(
          `INSERT INTO users (google_id, full_name, email, avatar_url, email_verified, last_login_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (google_id) DO UPDATE SET
             full_name = EXCLUDED.full_name,
             email = EXCLUDED.email,
             avatar_url = EXCLUDED.avatar_url,
             email_verified = EXCLUDED.email_verified,
             updated_at = CURRENT_TIMESTAMP,
             last_login_at = CURRENT_TIMESTAMP
           RETURNING id, google_id, full_name, email, avatar_url`,
          [googleId, fullName, email, avatarUrl, emailVerified]
        );
        if (result.rows[0]) {
          result.rows[0].role = isAdminUser ? 'admin' : 'user';
        }
      }

      const user = result.rows[0];
      return done(null, user);
    } catch (error) {
      console.error('Google OAuth error:', error.message);
      return done(error, null);
    }
  }));
}

// JWT helpers
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.cookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
}

// Auth middleware
function authenticateToken(req, res, next) {
  const token = req.cookies[COOKIE_NAME] || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

function optionalAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME] || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
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

app.get('/api/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Google OAuth is not configured' });
  }
  const state = req.query.redirect || '';
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
  })(req, res, next);
});

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/login?error=google_auth_failed`, session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
      }
      const token = generateToken(user);
      setAuthCookie(res, token);
      const redirectUrl = req.query.state || `${FRONTEND_URL}/dashboard`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Auth callback error:', error.message);
      res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
    }
  }
);

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    let result;
    try {
      result = await pool.query(
        'SELECT id, full_name, email, avatar_url, role, created_at FROM users WHERE id = $1',
        [req.user.id]
      );
    } catch (roleErr) {
      result = await pool.query(
        'SELECT id, full_name, email, avatar_url, created_at FROM users WHERE id = $1',
        [req.user.id]
      );
      if (result.rows.length > 0) {
        result.rows[0].role = 'user';
      }
    }
    if (result.rows.length === 0) {
      clearAuthCookie(res);
      return res.status(401).json({ message: 'User not found' });
    }
    const user = result.rows[0];
    const isAdminUser = user.email === ADMIN_EMAIL;
    if (isAdminUser && user.role !== 'admin') {
      try {
        await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
      } catch {}
      user.role = 'admin';
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({ message: 'Failed to get user data' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully' });
});

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
    const isAdminEmail = email.toLowerCase() === ADMIN_EMAIL;
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
    const token = generateToken(user);
    setAuthCookie(res, token);
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

    const token = generateToken(user);
    setAuthCookie(res, token);
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
      'SELECT id, pinecone_file_id FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Document not found' });

    const doc = result.rows[0];

    try {
      const pineconeIndex = getPineconeIndex();
      await pineconeIndex.deleteMany({ filter: { fileId: doc.pinecone_file_id } });
    } catch (pineErr) {
      console.error('Pinecone delete error:', pineErr.message);
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
    clearAuthCookie(res);
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

async function processFile(file, user) {
  return ingestDocument(file, user);
}

app.post('/api/upload', authenticateToken, (req, res) => {
  uploadMultiple(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ message: 'Upload error: ' + err.message });
      }

      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const results = [];
      for (const file of files) {
        const result = await processFile(file, req.user);
        results.push(result);

        try {
          await pool.query(
            `INSERT INTO documents (user_id, pinecone_file_id, file_name, chunk_count)
             VALUES ($1, $2, $3, $4)`,
            [req.user.id, result.fileId, result.fileName, result.chunks]
          );
        } catch (dbErr) {
          console.error('Failed to save document to DB:', dbErr.message);
        }
      }

      console.log(`\n=== ALL DONE: ${results.length} files indexed ===\n`);

      res.json({
        files: results,
        message: `${results.length} document(s) uploaded and indexed successfully`,
      });
    } catch (error) {
      console.error('Upload error:', error.message);
      res.status(500).json({ message: 'Failed to process document: ' + error.message });
    }
  });
});

// ==================== ANALYZE (MULTI-TURN) ====================

app.post('/api/analyze', authenticateToken, async (req, res) => {
  try {
    const { question, fileId, conversationId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Question is required' });
    }

    console.log(`\n=== ANALYZE: "${question}" ===`);

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

    // Get conversation history for multi-turn context
    const historyResult = await pool.query(
      `SELECT role, message FROM chat_messages
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [convId, req.user.id]
    );
    const previousMessages = historyResult.rows.slice(0, -1);

    // Run the RAG pipeline
    const result = await queryPipeline({
      question: question.trim(),
      fileId: fileId || null,
      userId: req.user.id,
      conversationId: convId,
      previousMessages,
    });

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

    console.log(`=== ANSWER READY ===\n`);

    res.json(result);
  } catch (error) {
    console.error('Analyze error:', error.message);
    console.error(error.stack);

    let userMessage = 'Analysis failed: ' + error.message;
    if (error.message && error.message.includes('Pipeline timeout')) {
      userMessage = 'The request took too long. Please try a shorter question or try again later.';
    } else if (error.message && error.message.includes('ECONNRESET')) {
      userMessage = 'Connection lost. Please try again.';
    } else if (error.message && error.message.includes('ETIMEDOUT')) {
      userMessage = 'Connection timed out. Please try again.';
    } else if (error.status === 429 || (error.message && error.message.includes('429'))) {
      userMessage = 'AI service is rate-limited. Please try again in a moment.';
    }

    res.status(500).json({ message: userMessage });
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
    const pineconeIndex = getPineconeIndex();
    const stats = await pineconeIndex.describeIndexStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
