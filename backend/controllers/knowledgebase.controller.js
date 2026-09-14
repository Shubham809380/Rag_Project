import pool from '../db.js';
import logger from '../utils/logger.js';

const LOG = 'KBController';

export async function listKnowledgeBases(req, res) {
  try {
    const result = await pool.query(
      `SELECT kb.id, kb.name, kb.description, kb.created_at, kb.updated_at,
              (SELECT COUNT(*) FROM documents d WHERE d.knowledge_base_id = kb.id) AS doc_count,
              (SELECT COUNT(*) FROM conversations c WHERE c.knowledge_base_id = kb.id) AS conv_count
       FROM knowledge_bases kb WHERE kb.user_id = $1 ORDER BY kb.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(LOG, 'List KB error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch knowledge bases' });
  }
}

export async function createKnowledgeBase(req, res) {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const result = await pool.query(
      `INSERT INTO knowledge_bases (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at, updated_at`,
      [req.user.id, name.trim().slice(0, 200), (description || '').trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'Create KB error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to create knowledge base' });
  }
}

export async function updateKnowledgeBase(req, res) {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      `UPDATE knowledge_bases SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, description, created_at, updated_at`,
      [name?.trim() || null, description != null ? description.trim() : null, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'Update KB error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update knowledge base' });
  }
}

export async function deleteKnowledgeBase(req, res) {
  try {
    const kb = await pool.query(
      'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (kb.rows.length === 0) return res.status(404).json({ success: false, message: 'Knowledge base not found' });

    // Delete vectors for all docs in this KB
    const docs = await pool.query(
      'SELECT pinecone_file_id FROM documents WHERE knowledge_base_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    const { default: pineconeService } = await import('../services/pinecone.service.js');
    for (const d of docs.rows) {
      try { await pineconeService.deleteByFilter({ fileId: d.pinecone_file_id }, { label: 'kb-delete' }); } catch {}
      await pool.query('DELETE FROM document_chunks WHERE document_id = (SELECT id FROM documents WHERE pinecone_file_id=$1 AND user_id=$2)',
        [d.pinecone_file_id, req.user.id]).catch(() => {});
    }

    await pool.query('UPDATE documents SET knowledge_base_id = NULL WHERE knowledge_base_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]);
    await pool.query('DELETE FROM conversations WHERE knowledge_base_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    await pool.query('DELETE FROM knowledge_bases WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Knowledge base deleted' });
  } catch (error) {
    logger.error(LOG, 'Delete KB error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete knowledge base' });
  }
}

export async function getKbStats(req, res) {
  try {
    const result = await pool.query(
      `SELECT kb.id, kb.name,
              (SELECT COUNT(*) FROM documents d WHERE d.knowledge_base_id = kb.id AND d.status='ready' AND d.embedding_status='ready') AS documents,
              (SELECT COUNT(*) FROM conversations c WHERE c.knowledge_base_id = kb.id) AS conversations,
              (SELECT COALESCE(SUM(d.chunk_count),0) FROM documents d WHERE d.knowledge_base_id = kb.id) AS chunks
       FROM knowledge_bases kb WHERE kb.id = $1 AND kb.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'KB stats error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch knowledge base stats' });
  }
}
