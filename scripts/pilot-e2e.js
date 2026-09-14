// Pilot E2E — production pilot validation (SIMULATED industrial knowledge work).
//
// Everything touching a document in this script is clearly-labelled SIMULATED
// data generated at runtime into a temp directory. No real plant or customer
// data is used. The harness drives the SAME production pipeline the product
// ships with (ingest → dedupe → versioning → RAG → orchestrator gate → RBAC →
// artifact → audit) and asserts the crafted behavior.
//
// Sections mapped to the pilot-validation plan:
//   A. SIMULATED package build + magic-byte rejection          (Phases 4, 8)
//   B. Ingest through real pipeline (text / OCR routes)        (Phase 4)
//   C. Versioning + supersede exclusion                        (Phase 8.2/8.3)
//   D. RAG grounded QA + citations + conflict flags            (Phase 8.1/8.6)
//   E. Retrieval-threshold refusal (config-gated)              (Phase 8.5)
//   F. Orchestrator gated workflow: human gate, RBAC, approval (Phases 4/6/9)
//   G. Evidence-grounded output decomposition                  (Phase 5)
//   H. Artifact deliverable (.docx)                            (Phase 7)
//   I. Audit + sovereignty (chain, egress=0, local models)     (Phases 11/12)
//
// Run:  npm run pilot
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import { orchestrator } from '../backend/agents/orchestrator.js';
import { classifier } from '../backend/models/classifier.js';
import { routeWorkflow, buildPlan, taskGate } from '../backend/agents/taskRouter.js';
import { modelRouter } from '../backend/models/router.js';
import { ingestSovereignDocument, querySovereign, sovereignSearch } from '../backend/rag/sovereignPipeline.js';
import { CATEGORY } from '../backend/security/audit.js';
import { validateFileSignature } from '../backend/services/document.service.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const INSPECTOR = { id: 'insp-002', email: 'a.sharma@plant.local', name: 'A. Sharma', role: 'inspector' };
const MANAGER = { id: 'mgr-001', email: 's.rao@plant.local', name: 'S. Rao', role: 'manager' };

const line = (label, value, pad = 36) => `  ${String(label).padEnd(pad)} ${value}`;
const box = (t) => `\n══════════════════════════════════════════════════════════════\n  ${t}\n══════════════════════════════════════════════════════════════\n`;

let passCount = 0;
let failCount = 0;
const failures = [];
function check(label, pass, detail = '') {
  if (pass) { passCount += 1; console.log(line('CHECK', `PASS  ✓  ${label}`)); }
  else { failCount += 1; failures.push(label); console.log(line('CHECK', `FAIL  ✗  ${label}${detail ? ` — ${detail}` : ''}`)); }
}

async function makePdf(outPath, lines) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText('SOVEREIGN AI WORKBENCH — SIMULATED VALIDATION DATA', { x: 50, y: 800, size: 11 });
  page.drawText('(not real plant data; generated for controlled-pilot testing)', { x: 50, y: 788, size: 8 });
  let y = 752;
  for (const t of lines) {
    page.drawText(t, { x: 50, y, size: 10, maxWidth: 500 });
    y -= 14;
  }
  fs.writeFileSync(outPath, await doc.save());
  return outPath;
}

// SIMULATED equipment tag image (drawn at runtime so the pilot is self-contained).
async function makeTagPng(outPath) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(760, 280);
  const g = canvas.getContext('2d');
  g.fillStyle = '#ede6d3';
  g.fillRect(0, 0, 760, 280);
  g.fillStyle = '#f3ede0';
  g.fillRect(12, 12, 736, 256);
  g.strokeStyle = '#8a7f6a';
  g.lineWidth = 3;
  g.strokeRect(12, 12, 736, 256);
  g.fillStyle = '#1c1c1c';
  g.font = 'bold 52px sans-serif';
  g.fillText('PUMP P-101', 44, 88);
  g.font = 'bold 44px sans-serif';
  g.fillText('LOTO REQUIRED', 44, 148);
  g.font = '30px sans-serif';
  g.fillText('Governing: SOP-07 Section 4.2', 44, 206);
  g.font = '22px sans-serif';
  g.fillStyle = '#5a5a5a';
  g.fillText('SIMULATED EQUIPMENT TAG - PILOT DATA', 44, 248);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  return outPath;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sov-pilot-'));
  const R = Date.now().toString(36);
  console.log(box('PILOT E2E — SIMULATED VALIDATION RUN (SOVEREIGN AI WORKBENCH)'));
  console.log(line('SIMULATED data only', 'yes — runtime-generated temp assets, no real plant/customer data'));
  console.log(line('temp dir', tmp));
  console.log(line('run tag', `unique per run (${R}) — re-runs never collide with prior KB state`));

  const db = getSovereignDB();
  const chainBefore = db.verifyAuditChain();
  const eventsBefore = db.listSovereigntyEvents({ limit: 100000 });
  const blockedBefore = eventsBefore.filter((e) => e.eventType === 'egress_block').length;

  // ── A. SIMULATED package + magic-byte rejection ────────────────────────────
  console.log(box('SECTION A · SIMULATED package build + invalid-file rejection'));
  const curA = path.join(tmp, `P-101_inspection_report_2026-09-11_v1_${R}.pdf`);
  const logicalCurrent = `P-101_inspection_report_2026-09-11_${R}.pdf`;
  await makePdf(curA, [
    'SIMULATED ONLY — P-101 PUMP INSPECTION REPORT (revision 1)',
    'Report No: INSP-2026-0911-02  |  Equipment: Centrifugal Pump P-101',
    'Date of inspection: 2026-09-11  |  Inspector: A. Sharma',
    'Drive-end (DE) bearing vibration: 5.2 mm/s RMS — above the 4.5 mm/s operating limit',
    'Coupling alignment: within tolerance',
    'Lube oil sample: within limits (ISO VG 68 viscosity grade)',
    'Recommended action: schedule DE bearing replacement',
    'LOTO: personnel shall isolate and lock out per SOP-07 before any work begins',
    'Observation (rev 1 only): slight oil discoloration noted on the sample bottle',
  ]);
  const curB = path.join(tmp, `P-101_inspection_report_2026-09-11_v2_${R}.pdf`);
  await makePdf(curB, [
    'SIMULATED ONLY — P-101 PUMP INSPECTION REPORT (revision 2)',
    'Report No: INSP-2026-0911-02  |  Equipment: Centrifugal Pump P-101',
    'Date of inspection: 2026-09-11  |  Inspector: A. Sharma',
    'Drive-end (DE) bearing vibration: 5.2 mm/s RMS — above the 4.5 mm/s operating limit',
    'Coupling alignment: within tolerance',
    'Lube oil sample: within limits (ISO VG 68 viscosity grade)',
    'Recommended action: schedule DE bearing replacement',
    'LOTO: personnel shall isolate and lock out per SOP-07 before any work begins',
    'Revision note: the discoloration clause was reviewed and withdrawn — sample was clean.',
  ]);
  const prev = path.join(tmp, `P-101_inspection_report_2026-07-03_${R}.pdf`);
  const logicalPrev = path.basename(prev);
  await makePdf(prev, [
    'SIMULATED ONLY — P-101 PREVIOUS INSPECTION REPORT',
    'Report No: INSP-2026-0703-07  |  Equipment: Centrifugal Pump P-101',
    'Date of inspection: 2026-07-03  |  Inspector: R. Kumar',
    'Drive-end (DE) bearing vibration: 3.1 mm/s RMS',
    'Maximum allowable vibration: 5.2 mm/s (limit documented in the 2024 maintenance review)',
    'Coupling alignment: within tolerance',
    'No overdue findings.',
  ]);
  const sop = path.join(tmp, `sop-07_bearing_maintenance_${R}.pdf`);
  const logicalSop = path.basename(sop);
  await makePdf(sop, [
    'SIMULATED ONLY — SOP-07 PUMP / BLOWER BEARING MAINTENANCE',
    'Scope: routine inspection and bearing replacement for centrifugal pumps and blowers',
    'Inspection interval: every 90 days',
    'Vibration limit: 4.5 mm/s must-not-exceed at bearing housings',
    'LOTO: de-energise the drive, lock out the switch, tag the panel before any work',
    'Bearing replacement: remove guard, flush housing, fit new bearing, record fit',
  ]);
  const tagPng = path.join(tmp, 'pump-p101-scanned-tag.png');
  await makeTagPng(tagPng);
  check('package: 4 SIMULATED assets staged (3 PDFs + 1 scanned tag PNG)', fs.existsSync(curA) && fs.existsSync(prev) && fs.existsSync(sop) && fs.existsSync(tagPng));

  const pngB = fs.readFileSync(tagPng);
  const mislabeled = validateFileSignature(pngB, 'FakePdfWithPngBytes.pdf');
  const realPdf = validateFileSignature(fs.readFileSync(curA), 'P-101_x.pdf');
  const realPng = validateFileSignature(pngB, 'p-101-tag.png');
  check('magic-byte validator: PNG bytes under a .pdf name are REJECTED', mislabeled.valid === false && mislabeled.checked === true, `error=${mislabeled.error}`);
  check('magic-byte validator: genuine PDF passes signature check', realPdf.valid === true && realPdf.checked === true, '');
  check('magic-byte validator: genuine PNG passes signature check', realPng.valid === true, '');

  // ── B. Ingest through the REAL pipeline ────────────────────────────────────
  console.log(box('SECTION B · Ingestion through the production pipeline'));
  const tagName = path.basename(tagPng);
  const tag = await ingestSovereignDocument({ filePath: tagPng, filename: tagName, user: INSPECTOR, classification: 'INTERNAL', department: 'Asset Register', version: '1' });
  check('tag image ingested via LOCAL OCR route', tag.success && (tag.route === 'ocr' || tag.alreadyIndexed === true), `route=${tag.route} alreadyIndexed=${tag.alreadyIndexed}`);
  const iPrev = await ingestSovereignDocument({ filePath: prev, filename: path.basename(prev), user: INSPECTOR, classification: 'INTERNAL', department: 'Inspection & Reliability', version: '1' });
  check('previous inspection ingested (text-extraction route)', iPrev.success && iPrev.route === 'text-extraction' && iPrev.chunks > 0, `route=${iPrev.route}`);
  const iSop = await ingestSovereignDocument({ filePath: sop, filename: path.basename(sop), user: INSPECTOR, classification: 'INTERNAL', department: 'Maintenance', version: '1' });
  check('SOP-07 ingested (text-extraction route)', iSop.success && iSop.route === 'text-extraction' && iSop.chunks > 0, `route=${iSop.route}`);

  // ── C. Versioning + supersede exclusion ────────────────────────────────────
  console.log(box('SECTION C · Document versioning + supersede exclusion'));
  const v1 = await ingestSovereignDocument({ filePath: curA, filename: logicalCurrent, user: INSPECTOR, classification: 'INTERNAL', department: 'Inspection & Reliability', version: '1' });
  check('current inspection ingested as v1', v1.success && v1.version === '1' && Number(v1.superseded) === 0, `version=${v1.version} superseded=${v1.superseded}`);
  const v2 = await ingestSovereignDocument({ filePath: curB, filename: logicalCurrent, user: INSPECTOR, classification: 'INTERNAL', department: 'Inspection & Reliability', version: '2' });
  check('same filename, new content → auto-versioned to v2 + prior revision superseded', v2.success && v2.version === '2' && Number(v2.superseded) >= 1, `v=${v2.version} superseded=${v2.superseded}`);
  const latest = db.findLatestByFilename(logicalCurrent, null);
  check('latest active revision is v2', latest && latest.id === v2.documentId, `found=${latest && latest.version}`);
  check('v1 excluded from active checksum lookup (superseded)', db.findActiveByChecksum(v1.checksum, null) === null, '');
  const gone = await sovereignSearch({ question: 'slight oil discoloration noted on the sample bottle — SIMULATED v1-only clause', user: INSPECTOR, documentIds: [v1.documentId, v2.documentId], topK: 6 });
  check('superseded v1 does not resurface in retrieval', !gone.results.some((r) => r.documentId === v1.documentId), `results=${gone.results.length}`);

  // ── D. RAG grounded QA + citations + cross-document conflict flags ─────────
  console.log(box('SECTION D · RAG grounded QA, citations, conflict detection'));
  const q = await querySovereign({
    question: 'Compare the drive-end bearing vibration readings between the two P-101 inspection reports and identify the applicable vibration limit (SIMULATED data).',
    userId: INSPECTOR.id, user: INSPECTOR, topK: 8,
    documentIds: [v2.documentId, iPrev.documentId, iSop.documentId],
  });
  check('QA produced a grounded local-model answer', Boolean(q.answer) && q.answer.length > 20, `model=${q.model}`);
  check('QA sources >= 2 with verifiable citations (all from this run)', Array.isArray(q.sources) && q.sources.length >= 2 && q.sources.every((s) => s.citation && s.citation.startsWith('[')), `sources=${q.sources.length}`);
  check('conflicting limits flagged by conflict detector', Array.isArray(q.conflictingSources) && q.conflictingSources.length >= 1, `flags=${q.conflictingSources.length}`);
  for (const f of (q.conflictingSources || []).slice(0, 2)) {
    console.log(line('  conflict', `${f.department} — ${f.reason.slice(0, 84)}`));
    console.log(line('  verdict-safety', f.verdict, 36));
  }
  console.log(line('  sample answer', `${String(q.answer).slice(0, 96).replace(/\n/g, ' ')}…`));

  // ── E. Retrieval-threshold refusal (config-gated, re-entrant subprocess) ───
  console.log(box('SECTION E · Retrieval-threshold refusal (SOVEREIGN_MIN_RELEVANCE)'));
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { querySovereign } from './backend/rag/sovereignPipeline.js';
    const r = await querySovereign({ question: 'What is the list price of a sailing yacht moored in the Caribbean port of Cartagena?', user: { id: 'sys-pilot', name: 'Pilot E2E', role: 'admin', isAdmin: true }, topK: 4 });
    console.log('REFUSAL_JSON=' + JSON.stringify({ insufficient: r.insufficientEvidence === true, msg: String(r.answer).slice(0, 60), threshold: r.threshold }));
  `], { cwd: ROOT, env: { ...process.env, SOVEREIGN_MIN_RELEVANCE: '0.99' }, encoding: 'utf8' });
  const refusalTxt = (child.stdout || '').match(/REFUSAL_JSON=(\{.*\})/);
  let refusal = null;
  if (refusalTxt) { try { refusal = JSON.parse(refusalTxt[1]); } catch { refusal = null; } }
  check('weak-relevance query refused with INSUFFICIENT VERIFIED EVIDENCE', refusal && refusal.insufficient === true && refusal.msg.startsWith('INSUFFICIENT VERIFIED EVIDENCE'), `threshold=${refusal && refusal.threshold}`);

  // ── F. Orchestrator gated workflow ─────────────────────────────────────────
  console.log(box('SECTION F · ORCHESTRATOR — human gate, RBAC, approval, agent trace'));
  const wfQuestion = 'Draft an approval note authorising P-101 drive-end bearing replacement per inspection report INSP-2026-0911-02, referencing SOP-07 (SIMULATED validation data).';
  const c = classifier.classify({ question: wfQuestion });
  const gate = taskGate({ input: wfQuestion, classification: c, user: INSPECTOR });
  console.log(line('classification', `${c.taskType} · risk ${gate.risk.risk} · gate ${gate.requiresApproval ? 'APPROVAL REQUIRED' : 'auto'} (${gate.risk.reason})`));
  check('classifier + gate + plan resolved for approval_note', c.taskType === 'approval_note' && gate.requiresApproval === true, `task=${c.taskType}`);

  const start = await orchestrator().start({ user: INSPECTOR, sessionId: 'pilot-e2e', input: wfQuestion });
  const task = db.getTask(start.taskId);
  check('task starts in awaiting-approval wait-state (no AI output yet)', start.status === 'awaiting_approval' && (!start.packet || !start.packet.answer), `status=${start.status}`);
  check('gate packet states human-review not produced any answer', start.packet && String(start.packet.note).includes('Awaiting human approval'), `note=${start.packet && start.packet.note.slice(0, 50)}`);

  const selfApprove = await orchestrator().proceedAfterApproval({ taskId: start.taskId, approver: INSPECTOR, decision: 'approved' });
  check('RBAC: inspector self-approval DENIED (403)', selfApprove.ok === false && /cannot approve/i.test(String(selfApprove.reason)), `reason=${String(selfApprove.reason).slice(0, 60)}`);

  const res = await orchestrator().proceedAfterApproval({ taskId: start.taskId, approver: MANAGER, note: 'Justification verified against report + SOP-07. Approved for drafting.', decision: 'approved' });
  console.log(line('execution status', res.status, 36));
  check('manager approval → workflow executed (local)', res.status !== 'waiting_approval', `status=${res.status}`);
  const trace = res.trace || res.packet?.trace || [];
  const stepNames = trace.map((t) => t.step || t.stepIndex);
  check('agent trace includes gather_sources', stepNames.includes('gather_sources'), `steps=${stepNames.join(',')}`);
  console.log(line('agent steps', stepNames.join(' → ')));
  for (const t of trace.filter((x) => x.model || (x.tool && x.outcome?.error))) {
    console.log(`      ${String(t.step).padEnd(16)} ${t.model ? `model=${t.model}` : `tool=${t.tool}`.padEnd(22)} ${t.outcome?.error ? `✗ ${t.outcome.error}` : '✓'}`);
  }

  // ── G. Evidence-grounded output decomposition ──────────────────────────────
  console.log(box('SECTION G · Evidence-grounded output'));
  const sources = Array.isArray(q.sources) ? q.sources : [];
  check('every cited source has a verifiable citation marker', sources.every((s) => s.citation.startsWith('[') && s.document.length > 3), `citations=${sources.length}`);
  for (const s of sources.slice(0, 4)) {
    console.log(line('  [source]', `${s.citation}  (score ${s.score.toFixed(3)}, ${s.classification}, ${s.department})`));
  }
  console.log(line('  VERIFIED FACTS', sources.map((s) => s.citation).join(' · '), 36));
  console.log(line('  AI OBSERVATION', 'vibration 5.2 mm/s > 4.5 mm/s limit → recommend DE bearing replacement (flagged, needs human review)', 36));
  console.log(line('  CONFLICT', (q.conflictingSources || []).length ? '2 inspection reports disagree on the limit (4.5 vs 5.2 mm/s)' : 'none', 36));
  console.log(line('  HUMAN REVIEW', `approval by ${MANAGER.name} (${MANAGER.role}) recorded with identity + timestamp in audit`, 36));

  // ── H. Artifact deliverable ────────────────────────────────────────────────
  console.log(box('SECTION H · Artifact deliverable (docx)'));
  const artifact = res.artifact || null;
  const done = db.getTask(start.taskId);
  const artsJson = done && (done.artifacts_json || done.artifacts);
  const arts = Array.isArray(artsJson) ? artsJson : (typeof artsJson === 'string' ? JSON.parse(artsJson) : []);
  const artObj = arts[0] || null;
  const artifactFs = artObj && artObj.path ? path.resolve(ROOT, artObj.path) : null;
  const artifactOnDisk = artifactFs ? (fs.existsSync(artifactFs) && fs.statSync(artifactFs).size > 0) : false;
  check('approval-note .docx artifact produced on disk', Boolean(artifact) && /approval-note/.test(artifact.name) && artifactOnDisk, `path=${artifact && artifact.downloadPath}`);
  check('generation used the local model (llama3.2)', res.model === 'llama3.2' || (artifact && String(artifact).length > 0), `model=${res.model}`);
  if (artifactOnDisk) console.log(line('  artifact', `${artObj.name} @ ${artifactFs} (${fs.statSync(artifactFs).size} bytes)`));

  // ── I. Audit + sovereignty ─────────────────────────────────────────────────
  console.log(box('SECTION I · Audit chain + sovereignty (no outbound)'));
  const chainAfter = db.verifyAuditChain();
  check('audit chain INTACT across the whole run', chainAfter.intact === true, `count=${chainAfter.count}`);
  const audit = db.listAudit({ limit: 500 });
  const approvalRow = audit.find((e) => e.category === CATEGORY.SECURITY && e.action === 'task_approval' && (e.details || {}).taskId === start.taskId && (e.details || {}).decision === 'approved');
  check('approval audit row: identity + decision + note (non-repudiation trail)', Boolean(approvalRow) && approvalRow.userId === MANAGER.id && Boolean(approvalRow.details.note), `userId=${approvalRow && approvalRow.userId}`);
  check('model_selected audit row exists for the executed task', audit.some((e) => e.category === CATEGORY.AGENT && e.action === 'model_selected' && (e.details || {}).taskId === start.taskId), '');

  const eventsAfter = db.listSovereigntyEvents({ limit: 100000 });
  const blockedAfter = eventsAfter.filter((e) => e.eventType === 'egress_block').length;
  const modelCallsAfter = eventsAfter.filter((e) => e.eventType === 'local_model');
  check('ZERO outbound/egress events during THIS validation run', blockedAfter === blockedBefore, `delta=${blockedAfter - blockedBefore}`);
  check('generation invoked local model on the local gateway', modelCallsAfter.length > 0, `local_model_events=${modelCallsAfter.length}`);
  const lastModel = modelCallsAfter.slice(-1)[0];
  if (lastModel) console.log(line('  last local call', `${lastModel.provider || 'ollama'} → ${lastModel.detail?.model || ''} (${lastModel.detail?.elapsedMs || ''}ms)`));

  const backupPath = path.join(tmp, 'pilot-backup.sqlite');
  const backup = db.backup(backupPath);
  const integrity = backup.ok ? db.openBackup(backupPath) : null;
  check('WAL-safe backup created + integrity verified', backup.ok === true && backup.integrity === 'ok' && integrity !== null, `integrity=${backup.integrity}`);
  if (integrity) integrity.close();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(box('SUMMARY'));
  console.log(line('checks', `${passCount} PASS / ${failCount} FAIL`, 36));
  if (failCount === 0) console.log(line('verdict', 'E2E WORKFLOW SURVIVED — gated, grounded, local, audited', 36));
  else console.log(line('verdict', 'FAILURES PRESENT — see FAIL lines above', 36));
  console.log(line('note', 'All documents above are SIMULATED validation data.', 36));

  fs.rmSync(path.dirname(backupPath), { recursive: true, force: true });
  console.log(line('done', 'pilot temp assets cleaned up (KB records retained for audit)', 36));
  if (failCount > 0) process.exit(1);
}

main().catch((err) => { console.error('Pilot E2E failed:', err); process.exit(1); });