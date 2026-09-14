import fs from 'fs';
import path from 'path';
import { getSovereignDB } from '../../storage/sovereignDB.js';
import { ocrImage, ocrPdf, probeProviders } from '../../ocr/ocrService.js';
import { analyzeImage as runVisionAnalysis } from '../../vision/visionService.js';
import { ToolError } from '../registry.js';

function resolveDoc(db, args) {
  let doc = args.documentId ? db.getDocument(args.documentId) : args.documentName ? db.getDocumentByFilenamePrefix(args.documentName) : null;
  if (!doc) throw new ToolError('Document not found', { code: 'DOCUMENT_NOT_FOUND' });
  if (!doc.filePath || !fs.existsSync(doc.filePath)) throw new ToolError(`Source file for ${doc.filename} is not stored on this host.`, { code: 'SOURCE_MISSING' });
  return doc;
}

export const ocrDocument = {
  name: 'ocr_document',
  description: 'Run local OCR on a stored document (scanned PDF or image) and return extracted text with page structure.',
  permissionLevel: 1,
  timeoutMs: 120000,
  inputSchema: { type: 'object', properties: { documentId: { type: 'string' }, documentName: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { pages: { type: 'array' }, provider: { type: 'string' } } },
  async run(args, ctx) {
    const db = getSovereignDB();
    const doc = resolveDoc(db, args);
    const ext = path.extname(doc.filename).toLowerCase();
    const probe = await probeProviders();
    if (probe.pdfRendering && ext === '.pdf') {
      const r = await ocrPdf(doc.filePath);
      if (r.ok) return { documentId: doc.id, pages: r.pages, provider: r.provider, detail: null };
      throw new ToolError(r.reason, { code: 'OCR_UNAVAILABLE' });
    }
    const r = await ocrImage(doc.filePath, ext);
    if (r.ok) return { documentId: doc.id, pages: r.pages, provider: r.provider, detail: r.detail || null };
    throw new ToolError(r.reason, { code: 'OCR_UNAVAILABLE' });
  },
};

export const analyzeImage = {
  name: 'analyze_image',
  description: 'Analyze an uploaded image or drawing using a local multimodal vision model. Returns structured observations with provenance and uncertainty (AI observation only).',
  permissionLevel: 1,
  timeoutMs: 120000,
  inputSchema: { type: 'object', properties: { documentId: { type: 'string' }, documentName: { type: 'string' }, prompt: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { observations: { type: 'object' }, provenance: { type: 'object' } } },
  async run(args, ctx) {
    const db = getSovereignDB();
    const doc = resolveDoc(db, args);
    const r = await runVisionAnalysis({ filePath: doc.filePath, fileType: doc.fileType, prompt: args.prompt });
    if (!r.ok) throw new ToolError(r.reason, { code: 'VISION_UNAVAILABLE' });
    return { documentId: doc.id, document: doc.filename, observations: r.observations, provenance: r.provenance, model: r.model, confidence: r.confidence };
  },
};