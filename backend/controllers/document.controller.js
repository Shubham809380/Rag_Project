import pool from '../db.js';
import * as pipelineService from '../services/pipeline.service.js';
import * as pineconeService from '../services/pinecone.service.js';
import * as documentService from '../services/document.service.js';
import logger from '../utils/logger.js';

const LOG = 'DocumentController';

function positiveInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function uploadDocuments(req, res) {
  const uploadStart = Date.now();
  try {
    const files = req.files;
    const kbId = req.body.knowledge_base_id || null;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, code: 'NO_FILES', message: 'No files uploaded', stage: 'upload', retryable: false });
    }

    if (kbId) {
      const kb = await pool.query('SELECT id FROM knowledge_bases WHERE id=$1 AND user_id=$2', [kbId, req.user.id]);
      if (kb.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'KB_NOT_FOUND', message: 'Knowledge base not found.' });
      }
    }

    logger.info(LOG, `Processing ${files.length} files`, { userId: req.user.id, kbId });
    const results = [];

    for (const file of files) {
      const fileStart = Date.now();
      logger.info(LOG, `Processing: ${file.originalname}`, { size: `${(file.size / 1024).toFixed(1)}KB` });

      let documentRow = null;
      try {
        const inserted = await pool.query(
          `INSERT INTO documents (user_id, knowledge_base_id, pinecone_file_id, file_name, file_size, file_type, status, embedding_status, pages)
           VALUES ($1,$2, $3, $4, $5, $6, 'processing', 'processing', 0)
           RETURNING id, pinecone_file_id`,
          [req.user.id, kbId, `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, file.originalname, file.size, documentService.detectFileType(file.originalname)]
        );
        documentRow = inserted.rows[0];
      } catch (dbErr) {
        logger.error(LOG, 'Failed to create document row', { error: dbErr.message });
      }

      let result;
      try {
        result = await pipelineService.ingestDocument(file, req.user, documentRow || {});
      } catch (ingestErr) {
        logger.error(LOG, `Ingest crashed: ${file.originalname}`, { error: ingestErr.message, stack: ingestErr.stack?.substring(0, 300) });
        documentService.cleanupFile(file.path);
        if (documentRow) {
          await pool.query(`UPDATE documents SET status='failed', embedding_status='failed', error_message=$2 WHERE id=$1`,
            [documentRow.id, `Unexpected error: ${ingestErr.message}`]).catch(() => {});
        }
        results.push({
          fileId: documentRow?.pinecone_file_id || null, fileName: file.originalname, pages: 0, chunks: 0,
          success: false, code: 'INGEST_CRASH', stage: 'pipeline',
          message: `Unexpected error processing ${file.originalname}: ${ingestErr.message}`,
          details: ingestErr.stack?.substring(0, 300) || ingestErr.message, retryable: true,
        });
        continue;
      }

      const fileElapsed = Date.now() - fileStart;
      logger.info(LOG, `Done: ${file.originalname}`, { chunks: result.chunks, ms: fileElapsed, code: result.code });

      if (!result.success && result.code) {
        if (documentRow) {
          await pool.query(`UPDATE documents SET status='failed', embedding_status='failed', error_message=$2 WHERE id=$1`,
            [documentRow.id, result.error || result.message || 'Processing failed']).catch(() => {});
        }
        results.push({ ...result, fileName: file.originalname });
        continue;
      }

      if (!result.chunks || result.chunks === 0) {
        if (documentRow) {
          await pool.query(`UPDATE documents SET status='failed', embedding_status='failed', error_message=$2 WHERE id=$1`,
            [documentRow.id, result.error || 'No chunks generated']).catch(() => {});
        }
        results.push({ ...result, fileName: file.originalname });
        continue;
      }

      results.push({ ...result, fileName: file.originalname, fileSize: file.size, fileType: result.fileType });
    }

    const totalElapsed = Date.now() - uploadStart;
    const successCount = results.filter(r => r.chunks > 0).length;
    const failCount = results.filter(r => !r.chunks || r.chunks === 0).length;

    logger.info(LOG, `COMPLETE: ${successCount} ok, ${failCount} fail (${totalElapsed}ms)`);

    res.json({
      files: results,
      message: failCount > 0
        ? `${successCount} document(s) uploaded. ${failCount} failed.`
        : `${results.length} document(s) uploaded and indexed successfully`,
    });
  } catch (error) {
    logger.error(LOG, 'Upload error', { error: error.message, stack: error.stack?.substring(0, 300) });
    res.status(500).json({
      success: false, code: 'UPLOAD_FAILED', stage: 'server',
      message: 'Failed to process document: ' + error.message,
      details: error.stack?.substring(0, 300) || error.message, retryable: true,
    });
  }
}

export async function getDocuments(req, res) {
  try {
    const kbId = req.query.knowledge_base_id || null;
    const search = req.query.search?.trim() || '';
    const page = positiveInt(req.query.page, 1);
    const limit = Math.min(positiveInt(req.query.limit, 50), 100);
    const offset = (page - 1) * limit;

    const conditions = ['d.user_id = $1'];
    const params = [req.user.id];
    let p = 2;
    if (kbId) { conditions.push(`d.knowledge_base_id = $${p}`); params.push(kbId); p++; }
    if (search) { conditions.push(`d.file_name ILIKE $${p}`); params.push(`%${search}%`); p++; }

    const result = await pool.query(
      `SELECT d.id, d.pinecone_file_id, d.file_name, d.file_size, d.file_type, d.chunk_count,
              d.pages, d.status, d.embedding_status, d.error_message, d.knowledge_base_id, d.created_at,
              (SELECT COUNT(*) FROM document_chunks dc WHERE dc.document_id = d.id) AS total_chunks
       FROM documents d
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    const count = await pool.query(
      `SELECT COUNT(*) AS count FROM documents d WHERE ${conditions.join(' AND ')}`, params
    );

    res.json({
      documents: result.rows,
      total: parseInt(count.rows[0].count, 10),
      page, limit,
    });
  } catch (error) {
    logger.error(LOG, 'Get documents error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
}

export async function getDocument(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, pinecone_file_id, file_name, file_size, file_type, chunk_count, pages,
              status, embedding_status, error_message, knowledge_base_id, created_at
       FROM documents WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(LOG, 'Get document error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch document' });
  }
}

export async function deleteDocument(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, pinecone_file_id, file_name FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Document not found' });

    const doc = result.rows[0];

    try {
      await pineconeService.deleteByFilter({ fileId: doc.pinecone_file_id }, { label: doc.file_name });
    } catch (pineErr) {
      logger.error(LOG, 'Pinecone delete error', { error: pineErr.message });
    }

    await pool.query('DELETE FROM document_chunks WHERE document_id = $1', [doc.id]);
    await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    logger.info(LOG, 'Document deleted', { id: doc.id, name: doc.file_name });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    logger.error(LOG, 'Delete document error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
}
