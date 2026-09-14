import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import { toolRegistry } from '../backend/tools/registry.js';
import { auditService } from '../backend/security/audit.js';
import { policy } from '../backend/security/policy.js';
import { monitor } from '../backend/monitor/monitor.js';
import { ingestSovereignDocument } from '../backend/rag/sovereignPipeline.js';
import { isDockerAvailable } from '../backend/sandbox/docker.js';
import XLSX from 'xlsx';
import '../backend/tools/index.js';

const LOG = '[tool-smoke]';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.error(`  ✗ FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};
const LIVE_LLM = process.env.TESTS_LIVE_LLM === '1';
const ADMIN = { id: 'smoke-admin', email: 'admin@local.workbench', name: 'Smoke Admin', role: 'admin' };
const ctx = () => ({ user: ADMIN, sessionId: 'tool-smoke', taskId: 't-smoke', audit: auditService(), policy: policy(), db: getSovereignDB(), monitor: monitor() });
const run = async (name, args) => toolRegistry().execute(name, args, ctx());

const TMP = path.join(os.tmpdir(), 'sovereign-smoke');
fs.mkdirSync(TMP, { recursive: true });
console.log(`\n[${LOG}] Tool smoke — ${LIVE_LLM ? 'live vision OCR/analysis' : 'vision gated (TESTS_LIVE_LLM=1)'}`);

// 1) Upload an .xlsx → read_excel returns plain rows (never executes formulas).
{
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Equipment', 'Status', 'Qty'], ['B-101', 'Over limit', 4], ['P-102', 'OK', 2]]);
  XLSX.utils.book_append_sheet(wb, ws, 'Assets');
  const xlsxPath = path.join(TMP, 'equipment-list.xlsx');
  fs.writeFileSync(xlsxPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  const ing = await ingestSovereignDocument({ filePath: xlsxPath, filename: 'equipment-list.xlsx', user: ADMIN });
  check('xlsx persisted for read_excel (text parse not required)', !!ing.documentId, `code=${ing.code || 'ok'} doc=${ing.documentId?.slice(0, 8)}`);
  if (ing.documentId) {
    const r = await run('read_excel', { documentId: ing.documentId });
    check('read_excel reads rows w/o formulas', r.ok && r.result.rows.some(rw => rw.includes('B-101')), `rows=${r.result?.rows?.length}`);
  }
}

// 2) Write an Excel artifact (write_excel) → programmatic read-back.
{
  const w = await run('write_excel', {
    name: 'computed-analysis.xlsx',
    sheets: [{ name: 'Analysis', header: ['Key', 'Value'], rows: [['Vibration limit', 4.5], ['Actual', 5.2]] }],
  });
  check('write_excel creates xlsx artifact', w.ok && !!w.result.artifact?.path, w.result?.artifact?.name);
  if (w.ok) {
    const buf = fs.readFileSync(w.result.artifact.path);
    const wb = XLSX.read(buf, { type: 'buffer', cellFormula: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    check('xlsx artifact readable back (Vibration limit=4.5)', rows.some(r => r[0] === 'Vibration limit' && r[1] === 4.5), JSON.stringify(rows[1]));
  }
}

// 3) Vision-backed doc intelligence on an ingested image (gated).
if (LIVE_LLM) {
  const pngPath = path.join(TMP, 'test-label.png');
  const ing = await ingestSovereignDocument({ filePath: pngPath, filename: 'label.png', user: ADMIN });
  check('label image ingested', ing.success === true, `route=${ing.route} chunks=${ing.chunks}`);
  if (ing.success) {
    const ocr = await run('ocr_document', { documentId: ing.documentId });
    check('ocr_document returns verbatim label text', ocr.ok && ocr.result.pages?.[0]?.text.includes('LOTO'), ocr.result?.pages?.[0]?.text?.slice(0, 60));
    const vis = await run('analyze_image', { documentId: ing.documentId });
    check('analyze_image returns structured observations + provenance', vis.ok && vis.result.observations?.textFound?.length > 0 && !!vis.result.provenance?.sourceImage, vis.result?.provenance?.sourceImage);
  }
} else {
  check('vision tools verify live when TESTS_LIVE_LLM=1', true, 'skipped (gated)');
}

// 4) Sandbox: honest refusal OR isolated execution.
{
  const docker = await isDockerAvailable();
  const py = await run('execute_python', { code: 'print(6*7)' }).then(r => ({ ok: r.ok, error: r.error, code: r.code, result: r.result })).catch(e => ({ ok: false, error: e.message, code: e.code }));
  check(`execute_python ${docker ? 'runs isolated' : 'honestly refused'}`, py.ok === true || (py.ok === false && py.code === 'SANDBOX_UNAVAILABLE'), py.code || 'ok');
  if (py.ok) check('python output correct', String(py.result?.stdout || '').trim() === '42', py.result?.stdout?.trim());
}

// 5) Knowledge tools on seeded docs (non-vision, always run).
{
  const sr = await run('search_knowledge_base', { question: 'bearing greasing preventive maintenance frequency', topK: 3 });
  check('search_knowledge_base returns grounded results', sr.ok && (sr.result.results || []).length > 0, `${(sr.result?.results || []).length} results`);
}

const out = fail === 0 ? 'PASS' : 'FAIL';
console.log(`\n[${LOG}] ${out} — ${pass} passed, ${fail} failed`);
process.exitCode = fail === 0 ? 0 : 1;
export default { pass, fail };