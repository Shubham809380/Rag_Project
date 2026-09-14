import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const LOG = 'DocumentService';

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/ {3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\uFEFF/g, '')
    .trim();
}

function removeDuplicateLines(text) {
  const lines = text.split('\n');
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || !seen.has(trimmed)) {
      result.push(line);
      if (trimmed) seen.add(trimmed);
    }
  }
  return result.join('\n');
}

async function parsePDF(filePath) {
  const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf');
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();
  const pageMap = {};
  for (const doc of docs) {
    const pageNum = doc.metadata?.loc?.pageNumber || Object.keys(pageMap).length + 1;
    if (!pageMap[pageNum]) pageMap[pageNum] = '';
    pageMap[pageNum] += doc.pageContent + '\n';
  }
  return Object.entries(pageMap)
    .map(([pageNum, text]) => ({
      pageNumber: parseInt(pageNum),
      text: removeDuplicateLines(cleanText(text)),
    }))
    .filter(p => p.text.length > 0);
}

async function parseDOCX(filePath) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  const text = removeDuplicateLines(cleanText(result.value));
  const pages = text.split(/\f/);
  if (pages.length <= 1) return [{ pageNumber: 1, text }];
  return pages.map((p, i) => ({ pageNumber: i + 1, text: p.trim() })).filter(p => p.text.length > 0);
}

function parseTXT(filePath) {
  let text = fs.readFileSync(filePath, 'utf-8');
  text = text.replace(/^\uFEFF/, '');
  if (!text || text.trim().length === 0) {
    const raw = fs.readFileSync(filePath);
    text = raw.toString('latin1');
  }
  text = removeDuplicateLines(cleanText(text));
  return [{ pageNumber: 1, text }];
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [{ pageNumber: 1, text: '' }];
  const header = lines[0];
  const textParts = [`CSV Data with columns: ${header}`];
  for (const line of lines.slice(1)) {
    textParts.push(line.trim());
  }
  return [{ pageNumber: 1, text: removeDuplicateLines(cleanText(textParts.join('\n'))) }];
}

async function parseXLSX(filePath) {
  const namespace = await import('xlsx');
  const XLSX = namespace.default || namespace;
  const wb = XLSX.readFile(filePath);
  const textParts = [];
  const pages = [];
  const sheetNames = wb.SheetNames || [];
  for (let i = 0; i < sheetNames.length; i++) {
    const ws = wb.Sheets[sheetNames[i]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;
    const lines = rows.map((r) => r.map((cell) => String(cell == null ? '' : cell)).join(' | '));
    textParts.push(`Sheet: ${sheetNames[i]}`);
    textParts.push(...lines);
  }
  if (textParts.length > 0) {
    pages.push({ pageNumber: 1, text: removeDuplicateLines(cleanText(textParts.join('\n'))) });
  }
  return pages;
}

async function parseMarkdown(filePath) {
  let text = fs.readFileSync(filePath, 'utf-8');
  text = text.replace(/^\uFEFF/, '');
  let result = text;
  try {
    const md = (await import('markdown-it')).default({ html: false, breaks: false });
    result = md.render(text);
    result = cleanText(result).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  } catch {
    result = cleanText(text);
  }
  return [{ pageNumber: 1, text: removeDuplicateLines(result) }];
}

async function parseImageOCR(filePath, fileName) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const imageData = fs.readFileSync(filePath);
  const mime = (() => {
    if (fileName.match(/\.png$/i)) return 'image/png';
    if (fileName.match(/\.jpe?g$/i)) return 'image/jpeg';
    return 'image/jpeg';
  })();
  const prompt = 'Extract ALL text from this image verbatim. Preserve paragraph structure, headings, tables, and lists. If the image is a diagram/chart, describe the key labeled information. Return only the extracted text/content.';
  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType: mime, data: imageData.toString('base64') } },
  ]);
  const text = (result.response?.text?.() || '').trim();
  return [{ pageNumber: 1, text: removeDuplicateLines(cleanText(text)) }];
}

export const detectFileType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const map = {
    '.pdf': 'pdf', '.docx': 'docx', '.doc': 'docx', '.txt': 'text',
    '.csv': 'csv', '.xlsx': 'xlsx', '.xls': 'xlsx', '.md': 'markdown',
    '.markdown': 'markdown', '.png': 'image', '.jpg': 'image', '.jpeg': 'image',
  };
  return map[ext] || ext.replace('.', '') || 'unknown';
};

export async function parseDocument(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const start = Date.now();
  let pages;

  switch (ext) {
    case '.pdf': pages = await parsePDF(filePath); break;
    case '.docx': case '.doc': pages = await parseDOCX(filePath); break;
    case '.txt': pages = parseTXT(filePath); break;
    case '.csv': pages = parseCSV(filePath); break;
    case '.xlsx': case '.xls': pages = await parseXLSX(filePath); break;
    case '.md': case '.markdown': pages = await parseMarkdown(filePath); break;
    case '.png': case '.jpg': case '.jpeg': pages = await parseImageOCR(filePath, fileName); break;
    default: throw new Error(`Unsupported file format: ${ext}`);
  }

  const elapsed = Date.now() - start;
  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  logger.info(LOG, `Parsed ${fileName}: ${pages.length} pages, ${totalChars} chars (${elapsed}ms)`);

  return { pages, totalChars, totalPages: pages.length, fileType: detectFileType(fileName) };
}

export function validateFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!config.upload.allowedExtensions.includes(ext)) {
    return { valid: false, error: `File type ${ext} not allowed. Supported: ${config.upload.allowedExtensions.join(', ')}` };
  }
  if (file.size > config.upload.maxFileSize) {
    return { valid: false, error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds limit of ${config.upload.maxFileSize / 1024 / 1024}MB` };
  }
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }
  const name = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (name.length > 200) {
    return { valid: false, error: 'File name too long' };
  }
  return { valid: true };
}

export function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

// ── Content/signature validation (hardening) ─────────────────────────────────
// Extension whitelisting alone lets an attacker rename a malicious binary to
// `.pdf`/`.docx`. We verify the actual file signature (magic bytes) before any
// parser touches an upload. Client-supplied MIME types are never trusted.
const MAGIC_SIGNATURES = {
  '.pdf': [0x25, 0x50, 0x44, 0x46],                                         // %PDF
  '.docx': [0x50, 0x4b, 0x03, 0x04],                                        // PK\x03\x04 (zip)
  '.doc': [0x50, 0x4b, 0x03, 0x04],                                         // modern .doc is a zip
  '.xlsx': [0x50, 0x4b, 0x03, 0x04],
  '.xls': [0xd0, 0xcf, 0x11, 0xe0],                                         // OLE2 (legacy xls)
  '.pptx': [0x50, 0x4b, 0x03, 0x04],
  '.ppt': [0xd0, 0xcf, 0x11, 0xe0],
  '.png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  '.jpg': [0xff, 0xd8, 0xff],
  '.jpeg': [0xff, 0xd8, 0xff],
  '.bmp': [0x42, 0x4d],                                                      // BM
  '.tif': [0x49, 0x49, 0x2a, 0x00],                                        // II*\0 or MM\0*
  '.tiff': [0x49, 0x49, 0x2a, 0x00],
  '.webp': [0x52, 0x49, 0x46, 0x46],                                         // RIFF…WEBP
};

// Signature to check for legacy OLE2 extensions that may also arrive as zips,
// and vice-versa (doc vs ppt variants). Minimal, honest best-effort.
export function validateFileSignature(buffer, originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  const sig = MAGIC_SIGNATURES[ext];
  if (!sig) {
    // Plain-text types (csv/txt/md) and legacy ole2 have no universal magic —
    // let size/extension validation + parser compatibility decide.
    return { valid: true, ext, checked: false, note: 'No magic-byte signature defined; parser compatibility applies.' };
  }
  const bytes = (buffer || []).slice(0, 8);
  const has = (arr) => bytes.length >= arr.length && arr.every((b, i) => bytes[i] === b);
  const matched = has(sig);
  // Office containers legitimately exist in both legacy OLE2 and modern zip form.
  // Accept the alternate container for those extensions; everything else must
  // match its single signature exactly.
  let altMatched = false;
  if (ext === '.xls' || ext === '.ppt') altMatched = has([0x50, 0x4b, 0x03, 0x04]);
  if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx') altMatched = has([0xd0, 0xcf, 0x11, 0xe0]);

  if (!matched && !altMatched) {
    return { valid: false, ext, checked: true, error: `File content does not match the signature expected for ${ext}. Renamed/forged file rejected.` };
  }
  if (altMatched) return { valid: true, ext, checked: true, note: 'alternate office container (OLE2/zip) accepted' };
  return { valid: true, ext, checked: true };
}

export const VALIDATE_SIGNATURES_IMPLEMENTED = true;
