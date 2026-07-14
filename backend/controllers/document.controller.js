import pool from '../db.js';
import * as pipelineService from '../services/pipeline.service.js';
import * as pineconeService from '../services/pinecone.service.js';
import * as documentService from '../services/document.service.js';
import logger from '../utils/logger.js';

const LOG = 'DocumentController';

export async function uploadDocuments(req, res) {
  const uploadStart = Date.now();
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    logger.info(LOG, `Processing ${files.length} files`, { userId: req.user.id });
    const results = [];

    for (const file of files) {
      const fileStart = Date.now();
      logger.info(LOG, `Processing: ${file.originalname}`, { size: `${(file.size / 1024).toFixed(1)}KB` });

      let result;
      try {
        result = await pipelineService.ingestDocument(file, req.user);
      } catch (ingestErr) {
        logger.error(LOG, `Ingest failed: ${file.originalname}`, { error: ingestErr.message });
        documentService.cleanupFile(file.path);
        results.push({
          fileId: null, fileName: file.originalname, pages: 0, chunks: 0,
          error: ingestErr.message, code: 'INGEST_FAILED',
        });
        continue;
      }

      const fileElapsed = Date.now() - fileStart;
      logger.info(LOG, `Done: ${file.originalname}`, { chunks: result.chunks, ms: fileElapsed });

      if (!result.chunks || result.chunks === 0) {
        results.push(result);
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO documents (user_id, pinecone_file_id, file_name, chunk_count)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, result.fileId, result.fileName, result.chunks]
        );
        logger.info(LOG, `Saved to DB: ${result.fileName}`, { chunks: result.chunks });
      } catch (dbErr) {
        logger.error(LOG, 'Failed to save document to DB', { error: dbErr.message });
      }

      results.push(result);
    }

    const totalElapsed = Date.now() - uploadStart;
    const successCount = results.filter(r => r.chunks > 0).length;
    const failCount = results.filter(r => r.chunks === 0).length;

    logger.info(LOG, `COMPLETE: ${successCount} ok, ${failCount} fail (${totalElapsed}ms)`);

    res.json({
      files: results,
      message: failCount > 0
        ? `${successCount} document(s) uploaded. ${failCount} failed.`
        : `${results.length} document(s) uploaded and indexed successfully`,
    });
  } catch (error) {
    logger.error(LOG, 'Upload error', { error: error.message });
    res.status(500).json({ success: false, stage: 'upload', message: 'Failed to process document: ' + error.message, retryable: true });
  }
}

export async function getDocuments(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, pinecone_file_id, file_name, chunk_count, created_at
       FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(LOG, 'Get documents error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
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

    await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    logger.info(LOG, 'Document deleted', { id: doc.id, name: doc.file_name });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    logger.error(LOG, 'Delete document error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
}
