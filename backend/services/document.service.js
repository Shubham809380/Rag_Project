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

export async function parseDocument(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const start = Date.now();
  let pages;

  switch (ext) {
    case '.pdf': pages = await parsePDF(filePath); break;
    case '.docx': pages = await parseDOCX(filePath); break;
    case '.txt': pages = parseTXT(filePath); break;
    case '.csv': pages = parseCSV(filePath); break;
    default: throw new Error(`Unsupported file format: ${ext}`);
  }

  const elapsed = Date.now() - start;
  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  logger.info(LOG, `Parsed ${fileName}: ${pages.length} pages, ${totalChars} chars (${elapsed}ms)`);

  return { pages, totalChars, totalPages: pages.length };
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
