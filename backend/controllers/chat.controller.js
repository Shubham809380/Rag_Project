import pool from '../db.js';
import * as pipelineService from '../services/pipeline.service.js';
import logger from '../utils/logger.js';

const LOG = 'ChatController';

export async function analyze(req, res) {
  const requestStart = Date.now();
  try {
    const { question, fileId, conversationId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }

    logger.info(LOG, `Analyze: "${question.substring(0, 80)}"`, { userId: req.user.id, fileId: fileId || 'all' });

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

    if (fileId) {
      const docCheck = await pool.query(
        'SELECT id, file_name, chunk_count FROM documents WHERE pinecone_file_id = $1 AND user_id = $2',
        [fileId, req.user.id]
      );
      if (docCheck.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' });
      }
      const doc = docCheck.rows[0];
      if (!doc.chunk_count || doc.chunk_count === 0) {
        return res.status(400).json({
          success: false, code: 'DOCUMENT_NOT_PROCESSED',
          message: `Document "${doc.file_name}" has not been processed (0 chunks). Please upload again.`,
        });
      }
    }

    const historyResult = await pool.query(
      `SELECT role, message FROM chat_messages WHERE conversation_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [convId, req.user.id]
    );
    const previousMessages = historyResult.rows.slice(0, -1);

    const result = await pipelineService.queryPipeline({
      question: question.trim(), fileId: fileId || null, userId: req.user.id,
      conversationId: convId, previousMessages,
    });

    const assistantMetadata = JSON.stringify({
      sources: result.sources || [], confidence: result.confidence || null,
      followUps: result.followUps || [], model: result.model || null,
    });
    await pool.query(
      `INSERT INTO chat_messages (user_id, conversation_id, role, message, metadata) VALUES ($1, $2, 'assistant', $3, $4)`,
      [req.user.id, convId, result.answer, assistantMetadata]
    );

    if (previousMessages.length === 0) {
      const shortTitle = question.length > 60 ? question.substring(0, 60) + '...' : question;
      await pool.query('UPDATE conversations SET title = $1 WHERE id = $2', [shortTitle, convId]);
    }

    const totalTime = Date.now() - requestStart;
    logger.info(LOG, `Analyze done`, { totalMs: totalTime, model: result.model, confidence: result.confidence });

    res.json(result);
  } catch (error) {
    const totalTime = Date.now() - requestStart;
    logger.error(LOG, `Analyze error (${totalTime}ms)`, { error: error.message });

    let userMessage = 'Analysis failed: ' + error.message;
    let statusCode = 500;

    if (error.message?.includes('Pipeline timeout')) {
      userMessage = 'The AI service took too long. Please try a shorter question or try again later.';
      statusCode = 504;
    } else if (error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT')) {
      userMessage = 'Connection lost. Please try again.';
    } else if (error.status === 429 || error.message?.includes('429')) {
      userMessage = 'AI service is rate-limited. Please try again in a moment.';
    }

    res.status(statusCode).json({
      success: false,
      stage: 'pipeline',
      code: statusCode === 504 ? 'AI_SERVICE_TIMEOUT' : 'ANALYSIS_FAILED',
      message: userMessage,
      retryable: statusCode >= 500,
    });
  }
}

export async function getConversations(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
       FROM conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(LOG, 'Get conversations error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
}

export async function createConversation(req, res) {
  try {
    const { title } = req.body;
    const result = await pool.query(
      `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at`,
      [req.user.id, title || 'New Chat']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'Create conversation error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to create conversation' });
  }
}

export async function updateConversation(req, res) {
  try {
    const { title } = req.body;
    const result = await pool.query(
      `UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 RETURNING id, title, updated_at`,
      [title, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'Update conversation error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update conversation' });
  }
}

export async function deleteConversation(req, res) {
  try {
    const result = await pool.query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    logger.error(LOG, 'Delete conversation error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete conversation' });
  }
}

export async function getMessages(req, res) {
  try {
    const conv = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (conv.rows.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const result = await pool.query(
      `SELECT id, role, message, metadata, created_at FROM chat_messages
       WHERE conversation_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
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
    logger.error(LOG, 'Get messages error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
}

export async function getHistory(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.created_at as date, c.updated_at as "createdAt",
              (SELECT message FROM chat_messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as question,
              (SELECT message FROM chat_messages WHERE conversation_id = c.id AND role = 'assistant' ORDER BY created_at DESC LIMIT 1) as answer
       FROM conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(LOG, 'Get history error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
}
