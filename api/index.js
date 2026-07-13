import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
});

const app = express();
const COOKIE_NAME = 'auth_token';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://insightrag.vercel.app';

app.use(cookieParser());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

function authenticateToken(req, res, next) {
  const token = req.cookies[COOKIE_NAME] || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ==================== AUTH ====================

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, avatar_url, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(401).json({ message: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get user data' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.cookie(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
  res.json({ message: 'Logged out' });
});

// ==================== CONVERSATIONS ====================

app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
       FROM conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
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
    res.status(500).json({ message: 'Failed to create conversation' });
  }
});

app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;
    const result = await pool.query(
      `UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id, title, updated_at`,
      [title, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Conversation not found' });
    res.json(result.rows[0]);
  } catch (error) {
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
      `SELECT id, role, message, metadata, created_at FROM chat_messages WHERE conversation_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [req.params.id, req.user.id]
    );
    const messages = result.rows.map(m => {
      const meta = m.metadata || {};
      return {
        id: m.id, role: m.role, content: m.message, created_at: m.created_at,
        sources: meta.sources || [], confidence: meta.confidence || null,
        followUps: meta.followUps || [], model: meta.model || null,
      };
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// ==================== DOCUMENTS ====================

app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, pinecone_file_id, file_name, chunk_count, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
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
      const { getPineconeIndex } = await import('../backend/rag/pipeline.js');
      const pineconeIndex = getPineconeIndex();
      await pineconeIndex.deleteMany({ filter: { fileId: doc.pinecone_file_id } });
    } catch (pineErr) {
      console.error('Pinecone delete error:', pineErr.message);
    }
    await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    res.json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete document' });
  }
});

// ==================== FILE UPLOAD (lazy load heavy deps) ====================

app.post('/api/upload', authenticateToken, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const fs = (await import('fs')).default;
    const pathMod = (await import('path')).default;
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = pathMod.dirname(__filename);
    const uploadsDir = '/tmp';

    const upload = multer({
      dest: uploadsDir,
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.txt', '.csv'];
        const ext = pathMod.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
      },
    });

    const uploadMultiple = upload.array('files', 10);
    uploadMultiple(req, res, async (err) => {
      try {
        if (err) return res.status(400).json({ message: 'Upload error: ' + err.message });
        const files = req.files;
        if (!files || files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

        const { ingestDocument } = await import('../backend/rag/pipeline.js');
        const results = [];
        for (const file of files) {
          const result = await ingestDocument(file, req.user);
          results.push(result);
          try {
            await pool.query(
              `INSERT INTO documents (user_id, pinecone_file_id, file_name, chunk_count) VALUES ($1, $2, $3, $4)`,
              [req.user.id, result.fileId, result.fileName, result.chunks]
            );
          } catch (dbErr) {
            console.error('Failed to save document to DB:', dbErr.message);
          }
        }
        res.json({ files: results, message: `${results.length} document(s) uploaded and indexed successfully` });
      } catch (error) {
        console.error('Upload error:', error.message);
        res.status(500).json({ message: 'Failed to process document: ' + error.message });
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload setup failed: ' + error.message });
  }
});

// ==================== ANALYZE (lazy load pipeline) ====================

app.post('/api/analyze', authenticateToken, async (req, res) => {
  try {
    const { question, fileId, conversationId } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ message: 'Question is required' });

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
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [convId]);

    const historyResult = await pool.query(
      `SELECT role, message FROM chat_messages WHERE conversation_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [convId, req.user.id]
    );
    const previousMessages = historyResult.rows.slice(0, -1);

    const { queryPipeline } = await import('../backend/rag/pipeline.js');
    const result = await queryPipeline({
      question: question.trim(),
      fileId: fileId || null,
      userId: req.user.id,
      conversationId: convId,
      previousMessages,
    });

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

    if (previousMessages.length === 0) {
      const shortTitle = question.length > 60 ? question.substring(0, 60) + '...' : question;
      await pool.query('UPDATE conversations SET title = $1 WHERE id = $2', [shortTitle, convId]);
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
    } else if (error.status === 429 || (error.message && error.message.includes('429'))) {
      userMessage = 'AI service is rate-limited. Please try again in a moment.';
    }

    res.status(500).json({ message: userMessage });
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
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) return res.status(400).json({ message: 'Name is required' });
    const result = await pool.query(
      `UPDATE users SET full_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, full_name, email, avatar_url`,
      [full_name.trim(), req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
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
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

app.delete('/api/user/account', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.cookie(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
    res.json({ message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

// ==================== ADMIN ====================

app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (roleResult.rows.length === 0 || roleResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const [users, docs, convs, msgs] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM documents'),
      pool.query('SELECT COUNT(*) as count FROM conversations'),
      pool.query("SELECT COUNT(*) as count FROM chat_messages WHERE role = 'user'"),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalDocuments: parseInt(docs.rows[0].count),
      totalConversations: parseInt(convs.rows[0].count),
      totalQuestions: parseInt(msgs.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (roleResult.rows.length === 0 || roleResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.role, u.auth_provider, u.email_verified, u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM documents WHERE user_id = u.id) as doc_count,
              (SELECT COUNT(*) FROM conversations WHERE user_id = u.id) as conv_count,
              (SELECT COUNT(*) FROM chat_messages WHERE user_id = u.id AND role = 'user') as question_count
       FROM users u ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// ==================== VISIT TRACKING ====================

app.post('/api/track-visit', async (req, res) => {
  try {
    const { page } = req.body;
    if (!page) return res.json({ ok: true });
    const ip = req.headers['x-forwarded-for'] || '';
    const ua = req.headers['user-agent'] || '';
    let userId = null, email = null;
    const token = req.cookies[COOKIE_NAME];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id; email = decoded.email;
      } catch {}
    }
    await pool.query(
      'INSERT INTO page_visits (user_id, email, page, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, page, ip, ua]
    );
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// ==================== DEBUG ====================

app.get('/api/debug', async (_req, res) => {
  try {
    const { getPineconeIndex } = await import('../backend/rag/pipeline.js');
    const pineconeIndex = getPineconeIndex();
    const stats = await pineconeIndex.describeIndexStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default app;
