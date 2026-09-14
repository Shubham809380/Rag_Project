import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sovereign from '../config/sovereign.js';
import { getSovereignDB } from '../storage/sovereignDB.js';
import { auditService } from '../security/audit.js';
import logger from '../utils/logger.js';

const LOG = 'ArtifactStore';

// ─────────────────────────────────────────────────────────────────────────────
// Artifact store — persists generated files with provenance metadata.
// Every artifact is content-addressed (sha256) and registered in the DB.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDocx({ title, meta = {}, sections = [], signature = null } = {}) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
  const children = [];
  if (title) children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
  for (const [k, v] of Object.entries(meta || {})) {
    children.push(new Paragraph({ children: [new TextRun({ text: `${k}:  `, bold: true }), new TextRun({ text: v })], spacing: { after: 60 } }));
  }
  for (const sec of sections || []) {
    children.push(new Paragraph({ text: sec.heading, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 80 } }));
    for (const para of sec.paragraphs || []) {
      children.push(new Paragraph({ children: [new TextRun({ text: para, size: 22 })], spacing: { after: 120 } }));
    }
    for (const item of sec.bullets || []) {
      children.push(new Paragraph({ text: `• ${item}`, bullet: { level: 0 }, spacing: { after: 60 } }));
    }
  }
  if (signature) {
    children.push(new Paragraph({ text: '', spacing: { before: 300 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: signature.role || '' })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: signature.name || '' })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: signature.date || new Date().toISOString().split('T')[0] })] }));
  }
  const doc = new Document({ sections: [{ properties: {}, children }] });
  return { doc, packer: Packer };
}

export async function generateXlsx({ sheets = [] } = {}) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets || []) {
    const ws = s.rows || [];
    const sheet = s.header ? XLSX.utils.aoa_to_sheet([s.header, ...ws.map(r => Array.isArray(r) ? r : Object.values(r))]) : XLSX.utils.aoa_to_sheet(ws.map(r => Array.isArray(r) ? r : Object.values(r)));
    XLSX.utils.book_append_sheet(wb, sheet, s.name || 'Sheet1');
  }
  return { wb };
}

export async function generatePdf({ title, lines = [], meta = {} } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]); // A4
  let y = 800;
  const margin = 50;
  page.drawText(title || 'Document', { x: margin, y, size: 18, font: bold });
  y -= 30;
  for (const [k, v] of Object.entries(meta || {})) {
    page.drawText(`${k}: ${v}`, { x: margin, y, size: 10, font });
    y -= 18;
  }
  y -= 12;
  for (const line of lines || []) {
    if (y < 40) { const p2 = doc.addPage([595, 842]); y = 800; page.drawText(line, { x: margin, y, size: 10, font }); y -= 16; continue; }
    page.drawText(String(line), { x: margin, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 16;
  }
  const bytes = await doc.save();
  return bytes;
}

export async function generatePptx({ title, slides = [] } = {}) {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  for (const s of slides || []) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F5F7FA' };
    if (s.title) slide.addText(s.title, { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 24, bold: true, color: '1F2937' });
    if (s.bullets && s.bullets.length) slide.addText(s.bullets.map(b => ({ text: b, options: { bullet: true } })), { x: 0.6, y: 1.5, w: 9, h: 5.5, fontSize: 16, color: '374151' });
    if (s.note) slide.addNotes(s.note);
  }
  const data = await pptx.write('nodebuffer');
  return data;
}

// ── persistence helpers ─────────────────────────────────────────────────────

export function artifactDir() { return sovereign.paths.artifactDir; }

export function ensureArtifactDir() {
  fs.mkdirSync(artifactDir(), { recursive: true });
  return artifactDir();
}

export async function saveArtifact({ taskId, userId, name, type, mime, buffer, meta = {} }) {
  ensureArtifactDir();
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const filePath = path.join(artifactDir(), safeName);
  await fs.promises.writeFile(filePath, buffer);
  const size = buffer.byteLength || buffer.length || 0;
  const record = getSovereignDB().createArtifact({ taskId, userId, name: safeName, type, mime, path: filePath, size, meta, checksum });
  auditService().record({ category: 'artifact', action: 'artifact_created', user: { id: userId }, details: { artifactId: record.id, name: safeName, type, size, taskId } });
  logger.info(LOG, `Artifact saved: ${safeName} (${size} bytes)`);
  return record;
}

async function toBuffer(data) {
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === 'string') return Buffer.from(data, 'utf-8');
  return null;
}

// Shim so './docx.js/xlsx.js' style generators can be called uniformly.
export const artifactGenerators = { generateDocx, generateXlsx, generatePdf, generatePptx };