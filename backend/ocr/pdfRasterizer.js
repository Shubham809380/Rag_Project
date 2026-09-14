import logger from '../utils/logger.js';

const LOG = 'PDFRasterizer';

// ─────────────────────────────────────────────────────────────────────────────
// Scanned-PDF rasterization WITHOUT system packages (no poppler/pdftoppm).
// Uses pdf.js (legacy build) + @napi-rs/canvas to render each PDF page to PNG
// entirely in-process. Degrades gracefully to `available:false` when these
// optional modules are not installed, so the rest of the sovereign OCR pipeline
// stays honest ("OCR required / rasterizer missing") instead of failing.
// ─────────────────────────────────────────────────────────────────────────────

let _mods = null;
let _probeTs = 0;

export async function rasterizerAvailable({ force = false } = {}) {
  if (_mods && !force) return true;
  if (_mods === null || force) {
    try {
      const [pdfjs, canvas] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('@napi-rs/canvas'),
      ]);
      _mods = { pdfjs, canvas };
      _probeTs = Date.now();
      return true;
    } catch (err) {
      logger.warn(LOG, 'In-process PDF rasterizer unavailable', { error: err.message });
      _mods = null;
      return false;
    }
  }
  return _mods !== null;
}

// Render every page of a PDF to PNG Buffers. scale=2 (~144dpi) is a good
// compromise between OCR quality and memory on small hosts.
export async function rasterizePdf(filePath, { scale = 2, maxPages = 50 } = {}) {
  if (!(await rasterizerAvailable())) {
    return { ok: false, reason: 'In-process PDF rasterizer is not installed (pdfjs-dist / @napi-rs/canvas). Install them or poppler-utils for scanned-PDF OCR.' };
  }
  const { pdfjs, canvas } = _mods;
  const buffer = new Uint8Array((await import('fs')).readFileSync(filePath));
  let doc = null;
  try {
    doc = await pdfjs.getDocument({ data: buffer, isEvalSupported: false, useSystemFonts: false }).promise;
    if (doc.numPages > maxPages) return { ok: false, reason: `PDF has ${doc.numPages} pages; rasterizer caps at ${maxPages}.` };
    await doc.getMetadata().catch(() => null);
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const image = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = image.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push({ pageNumber: i, png: image.toBuffer('image/png') });
      page.cleanup();
    }
    return { ok: true, pages };
  } catch (err) {
    logger.error(LOG, 'Rasterization failed', { error: err.message });
    return { ok: false, reason: `PDF rasterization failed: ${err.message}` };
  } finally {
    try { await doc?.destroy(); } catch { /* noop */ }
  }
}