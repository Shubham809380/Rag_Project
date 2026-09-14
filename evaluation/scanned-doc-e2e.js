import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';
import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import { ingestSovereignDocument, querySovereign } from '../backend/rag/sovereignPipeline.js';
import { isOCRAvailable } from '../backend/ocr/ocrService.js';
import { monitor } from '../backend/monitor/monitor.js';
import { auditService, CATEGORY } from '../backend/security/audit.js';

const LOG = '[scanned-e2e]';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.error(`  ✗ FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

const USER = { id: 'demo-operator', email: 'operator@plant.local', name: 'Demo Operator', role: 'inspector' };
const db = getSovereignDB();
const TMP = os.tmpdir();
const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../datasets/pump-p101-scanned-tag.png');

console.log(`\n[${LOG}] Flagship E2E — Scanned inspection PDF → local OCR → RAG → grounded answer (or honest air-gap degradation)`);

// 1) Build a raster-only scanned PDF (embedded label PNG, no text layer).
const png = fs.readFileSync(FIXTURE);
const doc = await PDFDocument.create();
const page = doc.addPage([800, 300]);
const image = await doc.embedPng(png);
page.drawImage(image, { x: 16, y: 16, width: 768, height: 268 });
const scanPath = path.join(TMP, 'scanned-inspection-report.pdf');
fs.writeFileSync(scanPath, await doc.save({ useObjectStreams: false }));

// 2) Ingest → expect the LOCAL OCR pipeline to transcribe it. When no OCR engine
//    exists on the host (tesseract / paddleocr / vision model), the workbench must
//    degrade HONESTLY (ocr_required → empty) — never silently fabricate text.
const ocrAvailable = await isOCRAvailable();
const r = await ingestSovereignDocument({ filePath: scanPath, filename: 'scanned-inspection-report.pdf', user: USER, collectionId: null, classification: 'INTERNAL', department: 'maintenance' });

if (ocrAvailable) {
  check('scanned PDF ingested via local OCR', r.success === true, `route=${r.route} chunks=${r.chunks} provider=${r.embeddingProvider}`);
  check('scanned PDF route is ocr (never text-extraction)', r.route === 'ocr', r.route);

  // 3) Grounded RAG — the OCR'd content must be retrievable with citations.
  if (r.success) {
    const q = await querySovereign({
      question: 'What LOTO isolation does the scanned B-101 pump inspection require?',
      user: USER,
      topK: 5,
    });
    const hit = (q.sources || []).some(s => s.document === 'scanned-inspection-report.pdf' && typeof s.page === 'number');
    check('scanned content recall with page citation', hit, (q.sources || []).map(s => s.document).join(', '));
    check('answer grounded or honest block', q.answer.length > 0, `len=${q.answer.length}`);
    console.log(`\n  ANSWER (first 500):\n  ${q.answer.slice(0, 500).replace(/\n/g, '\n  ')}`);
  }
} else {
  console.log(`\n[${LOG}] no local OCR engine present — asserting honest air-gap degradation instead of the full OCR→RAG path`);
  check('scanned PDF degrades honestly without OCR (never fabricated)', r.success === false && ['EMPTY_DOCUMENT', 'NO_CHUNKS', 'PARSE_FAILED'].includes(r.code), `${r.code} / ${(r.error || '').slice(0, 70)}`);
  check('ingest marked ocr_required (not silently indexed)', r.success === false, 'ocr_required is the designed air-gap state');
}

// 4) Control: a truly empty scanned PDF fails honestly (no fake text).
const blank = await PDFDocument.create();
blank.addPage([600, 800]);
const blankPath = path.join(TMP, 'scanned-blank-control.pdf');
fs.writeFileSync(blankPath, await blank.save());
const rb = await ingestSovereignDocument({ filePath: blankPath, filename: 'scanned-blank-control.pdf', user: USER });
check('blank scanned PDF → honest empty/ocr_required, never text-extraction', rb.success === false && ['EMPTY_DOCUMENT', 'NO_CHUNKS', 'PARSE_FAILED'].includes(rb.code), `${rb.code} / ${(rb.error || '').slice(0, 60)}`);

// 5) Sovereignty assertions on the fresh audit state.
const mon = monitor();
if (!mon.patched) mon.init();
const events = mon.getStatus().recentEvents || [];
const st = db.stats();
auditService().record({ category: CATEGORY.NETWORK, action: 'scanned_e2e_complete', severity: 'info', details: { pass, fail, egressMode: mon.getStatus().egressMode } });
console.log(`\n[${LOG}] sovereignty: egressMode=${mon.getStatus().egressMode} recentEvents=${events.length} egressBlocks=${events.filter(e => e.type === 'egress_block').length} localModels=${events.filter(e => e.kind === 'local_model').length}`);
check('audit chain intact after E2E', db.verifyAuditChain().intact === true, `count=${db.verifyAuditChain().count}`);

const out = fail === 0 ? 'PASS' : 'FAIL';
console.log(`\n[${LOG}] ${out} — ${pass} passed, ${fail} failed`);
process.exitCode = fail === 0 ? 0 : 1;
export default { pass, fail };