// RAG gate probe: run with SOVEREIGN_MIN_RELEVANCE=0.99 to force the
// insufficient-evidence path (config reads env at import, so it MUST be set
// on the process, not inside this file).
const gate = process.env.SOVEREIGN_MIN_RELEVANCE;
if (!gate || parseFloat(gate) <= 0) {
  console.error('GATE PROBE REQUIRES SOVEREIGN_MIN_RELEVANCE>0 on the process env');
  process.exit(2);
}
const gateThreshold = parseFloat(gate);

import fs from 'fs';
import path from 'path';
import os from 'os';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'url';
import { ingestSovereignDocument, querySovereign } from '../backend/rag/sovereignPipeline.js';
import { isOCRAvailable } from '../backend/ocr/ocrService.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { pass += ok ? 1 : 0; fail += ok ? 0 : 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} — ${d}`); };

const USER = { id: 'gate-operator', email: 'operator@plant.local', name: 'Gate Operator', role: 'inspector' };
const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../datasets/pump-p101-scanned-tag.png');

const png = fs.readFileSync(FIXTURE);
const doc = await PDFDocument.create();
const page = doc.addPage([800, 300]);
const image = await doc.embedPng(png);
page.drawImage(image, { x: 16, y: 16, width: 768, height: 268 });
const scanPath = path.join(os.tmpdir(), 'scanned-gate-probe.pdf');
fs.writeFileSync(scanPath, await doc.save());

const ocrAvailable = await isOCRAvailable();
const r = await ingestSovereignDocument({ filePath: scanPath, filename: 'scanned-gate-probe.pdf', user: USER, classification: 'INTERNAL', department: 'maintenance' });

if (!ocrAvailable || !r.success) {
  check('OCR available (pipeline reachable)', false, `ocr=${ocrAvailable} ingest=${r.code || r.error}`);
  console.log('GATE PROBE SKIPPED — no OCR engine');
} else {
  // Off-topic question → retrieval scores must fall below the forced 0.99 threshold.
  const q = await querySovereign({ question: 'What is the menu price of cheese pizza at an unrelated cafeteria?', user: USER, topK: 3 });
  const gateOk = q.insufficientEvidence === true && /INSUFFICIENT VERIFIED EVIDENCE/.test(q.answer) && Math.abs(q.threshold - gateThreshold) < 0.0001;
  check('off-topic retrieval blocked by minRelevance', gateOk, `threshold=${q.threshold} score=${q.retrievalScore} conf=${q.confidence}`);
  check('no fabricated sources on weak match', Array.isArray(q.sources) && q.sources.every(s => (s.score || 0) < q.threshold), `sources=${(q.sources || []).length}`);
}

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);