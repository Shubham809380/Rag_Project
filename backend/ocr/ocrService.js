import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { modelRouter } from '../models/router.js';
import { analyzeImage } from '../vision/visionService.js';
import logger from '../utils/logger.js';

const LOG = 'OCRService';
const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// OCR abstraction over fully local engines, in preference order:
//   1. tesseract binary          (offline, classic)
//   2. PaddleOCR via python sidecar  (offline, higher quality)
//   3. local multimodal vision model   (router-driven, no extra install)
// Each provider is probed at runtime; when none is available we say so — we
// never reach for a cloud OCR service.
// ─────────────────────────────────────────────────────────────────────────────

async function findTesseract() {
  // `tesseract` on PATH first (Linux/macOS/Windows if user configured it).
  const candidates = ['tesseract'];
  // Windows winget "UB-Mannheim.TesseractOCR" installs to Program Files but does
  // not add itself to PATH — probe the standard install location explicitly.
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
      if (base) candidates.push(path.join(base, 'Tesseract-OCR', 'tesseract.exe'));
    }
  }
  for (const bin of candidates) {
    try {
      const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 5000 });
      return { available: true, version: stdout.split('\n')[0], bin };
    } catch { /* try next candidate */ }
  }
  return { available: false };
}

async function findPaddleOCR() {
  try {
    const { stdout } = await execFileAsync('python', ['-c', 'import paddleocr; print(paddleocr.__version__)'], { timeout: 10000 });
    return { available: true, version: stdout.trim() };
  } catch {
    return { available: false };
  }
}

async function findPdfTools() {
  let poppler = false;
  try {
    await execFileAsync('pdftoppm', ['-v'], { timeout: 5000 });
    poppler = true;
  } catch { poppler = false; }
  // In-process fallback (pdf.js + @napi-rs/canvas) — no system package needed.
  let inProcess = false;
  try {
    const { rasterizerAvailable } = await import('./pdfRasterizer.js');
    inProcess = await rasterizerAvailable();
  } catch { inProcess = false; }
  return { poppler, inProcess, available: poppler || inProcess };
}

async function visionOCRModelAvailable() {
  try {
    const d = await modelRouter().decide({ taskType: 'ocr' });
    return d.available && !!d.decisionModelId;
  } catch {
    return false;
  }
}

let _probe = null;
export async function probeProviders({ force = false } = {}) {
  if (_probe && !force) return _probe;
  const [tesseract, paddle, hasPdfTools, vision] = await Promise.all([
    findTesseract(), findPaddleOCR(), findPdfTools(), visionOCRModelAvailable(),
  ]);
  _probe = {
    tesseract: tesseract.available, tesseractVersion: tesseract.version || '',
    tesseractBin: tesseract.bin || null,
    paddleOCR: paddle.available, paddleVersion: paddle.version || '',
    pdfRendering: hasPdfTools.available,
    poppler: hasPdfTools.poppler,
    rasterizer: hasPdfTools.inProcess,
    visionModel: vision,
    available: tesseract.available || paddle.available || vision,
  };
  return _probe;
}

export async function isOCRAvailable() {
  const p = await probeProviders();
  return p.available;
}

async function tesseractImage(filePath) {
  const probe = await probeProviders();
  const bin = probe.tesseractBin || 'tesseract';
  const out = await execFileAsync(bin, [filePath, 'stdout', '-l', 'eng+' + (process.env.TESS_LANGS || 'eng')]);
  return { text: String(out.stdout || '').trim(), provider: 'tesseract' };
}

// Heuristic quality assessment of OCR output — never a substitute for a real
// confidence score, but enough to route blank/illegible scans away from being
// treated as verified document text.
function assessOcr(text) {
  const clean = String(text || '').replace(/\s+/g, ' ');
  const chars = clean.replace(/\s/g, '');
  const alnum = (chars.match(/[a-zA-Z0-9]/g) || []).length;
  const ratio = chars.length ? alnum / chars.length : 0;
  const detail = {
    blankScan: clean.trim().length < 4 || chars.length === 0,
    lowConfidence: chars.length > 0 && chars.length < 20,
    lowQuality: chars.length >= 20 && ratio < 0.8,
    chars: chars.length,
    alnumRatio: Number(ratio.toFixed(3)),
    warning: null,
  };
  if (detail.blankScan) detail.warning = 'Blank scan or empty page — no readable text found. No indexing performed; a human must verify the physical document.';
  else if (detail.lowConfidence) detail.warning = 'Very little text extracted — possible poor-quality or partially scanned page. Treat as AI OCR observation, not verified content.';
  else if (detail.lowQuality) detail.warning = 'Extracted OCR text quality is low (many non-alphanumeric characters). Requires human verification before any engineering use.';
  return detail;
}

async function paddleOCRImage(filePath) {
  const script = path.join(os.tmpdir(), 'paddle_ocr_runner.py');
  fs.writeFileSync(script, `import sys, json
from paddleocr import PaddleOCR
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
res = ocr.ocr(sys.argv[1], cls=True)
lines=[]
if res and res[0]:
    for r in res[0]:
        box, (txt, conf) = r
        lines.append(txt)
print(json.dumps(lines))
`);
  const { stdout } = await execFileAsync('python', [script, filePath], { timeout: 120000 });
  let lines = [];
  try { lines = JSON.parse(stdout); } catch {}
  return { text: lines.join('\n'), provider: 'paddleocr' };
}

async function visionImageOCR(filePath, ext) {
  const res = await analyzeImage({
    filePath, fileType: ext,
    prompt: 'Extract ALL readable text from this image verbatim, preserving paragraph/table/list structure. Output sections in order.',
  });
  if (!res.ok) throw new Error(res.reason);
  // OCR text must be VERBATIM strings read from the image. Never use the model's
  // narrative description as document text — a blank scan must yield no text.
  const readable = (res.observations?.textFound || []).map(s => String(s).trim()).filter(Boolean);
  return { text: readable.join('\n'), provider: 'vision-model', raw: res };
}

// OCR a single image file → pages [{ pageNumber, text }]
export async function ocrImage(filePath, fileType = 'image') {
  const probe = await probeProviders();
  if (!probe.available) {
    return { ok: false, reason: 'No local OCR engine available (checked: tesseract, paddleocr, vision model). Install one or configure a local vision model.', provider: 'none', detail: { blankScan: true, lowConfidence: true, lowQuality: false, warning: 'No OCR engine available.' } };
  }
  const ext = path.extname(filePath).toLowerCase();
  let attempt = null;
  let lastErr = null;
  const order = probe.tesseract ? ['tesseract', 'paddleocr', 'vision-model'] : probe.paddleOCR ? ['paddleocr', 'vision-model'] : ['vision-model'];
  for (const p of order) {
    try {
      if (p === 'tesseract') attempt = await tesseractImage(filePath);
      else if (p === 'paddleocr') attempt = await paddleOCRImage(filePath);
      else attempt = await visionImageOCR(filePath, ext);
      const detail = assessOcr(attempt.text);
      if (attempt.text && attempt.text.length > 3) {
        return { ok: true, pages: [{ pageNumber: 1, text: attempt.text }], provider: attempt.provider, detail };
      }
      // A provider succeeded but read nothing → blank scan, stop trying engines.
      return { ok: false, reason: 'OCR returned no readable text (blank scan or illegible page).', provider: attempt.provider, blankScan: true, detail };
    } catch (err) {
      lastErr = err;
      logger.warn(LOG, `OCR provider ${p} failed`, { error: err.message });
    }
  }
  return { ok: false, reason: `OCR failed: ${lastErr?.message || 'unknown'}`, provider: 'none' };
}

// Render a PDF's pages to PNG for OCR. Prefers system poppler; falls back to the
// in-process pdf.js rasterizer so scanned-PDF OCR works on hosts without poppler.
async function pdfToPngs(filePath) {
  const probe = await probeProviders({ force: true });
  if (probe.poppler) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sovereign-ocr-'));
    execFileSync('pdftoppm', ['-r', '200', '-png', filePath, path.join(tmpDir, 'page')], { timeout: 120000 });
    const files = fs.readdirSync(tmpDir).filter(f => /^page.*\.png$/.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { ok: true, tmpDir, files };
  }
  if (probe.rasterizer) {
    const { rasterizePdf } = await import('./pdfRasterizer.js');
    const r = await rasterizePdf(filePath);
    if (!r.ok) return { ok: false, reason: r.reason };
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sovereign-ocr-'));
    const files = [];
    for (const p of r.pages) {
      const f = path.join(tmpDir, `page-${p.pageNumber}.png`);
      fs.writeFileSync(f, p.png);
      files.push(f);
    }
    return { ok: true, tmpDir, files, rasterizer: true };
  }
  return { ok: false, reason: 'No PDF rendering tool (poppler-utils / pdf.js rasterizer) available to rasterise pages for OCR.', tmpDir: null, files: [] };
}

// OCR a PDF: render pages to images then OCR each. Returns empty pages (with an
// honest reason) when no renderer is available — never a cloud fallback.
export async function ocrPdf(filePath) {
  const render = await pdfToPngs(filePath);
  if (!render.ok) {
    return { ok: false, reason: render.reason, provider: 'none' };
  }
  try {
    const pages = [];
    for (let i = 0; i < render.files.length; i++) {
      const r = await ocrImage(render.files[i], 'image/png');
      if (r.ok) pages.push({ pageNumber: i + 1, text: r.pages[0].text });
    }
    return { ok: pages.length > 0, pages, provider: render.rasterizer ? 'pdf-ocr(in-process)' : 'pdf-ocr(poppler)' };
  } finally {
    fs.rmSync(render.tmpDir, { recursive: true, force: true });
  }
}