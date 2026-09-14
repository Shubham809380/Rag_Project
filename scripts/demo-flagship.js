// Flagship end-to-end example — "killer walkthrough".
//
// Mirrors the narrated example flow (docs/architecture.md):
//   1. Seed the local knowledge base (SOPs, LOTO, inspection report)
//   2. Scene: inspector asks for an approval note driven by a (SIMULATED)
//      inspection report + SOP-07/POL-12
//   3. Classifier → approval_note (HIGH risk) → human-in-the-loop gate
//   4. Wrong approver is rejected (RBAC enforced in the orchestrator)
//   5. Manager approves → agent executes (retrieval → generation → .docx)
//   6. Sovereignty report: 0 outbound, all model calls on 127.0.0.1,
//      audit chain INTACT
//
// Works with or without a local model gateway:
//   - model available  → real local generation + real .docx artifact
//   - model unavailable → honest `model_unavailable` packet (no fabrication)
//
// Run:  npm run demo:flagship
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import { orchestrator } from '../backend/agents/orchestrator.js';
import { classifier } from '../backend/models/classifier.js';
import { routeWorkflow, buildPlan, taskGate } from '../backend/agents/taskRouter.js';
import { policy } from '../backend/security/policy.js';
import { modelRouter } from '../backend/models/router.js';
import { ingestSovereignDocument } from '../backend/rag/sovereignPipeline.js';
import { seedSovereign } from './demo-seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'datasets');

const INSPECTOR = { id: 'insp-002', email: 'a.sharma@plant.local', name: 'A. Sharma', role: 'inspector' };
const MANAGER = { id: 'mgr-001', email: 's.rao@plant.local', name: 'S. Rao', role: 'manager' };

const line = (label, value, pad = 34) => `  ${String(label).padEnd(pad)} ${value}`;
const box = (t) => `\n══════════════════════════════════════════════════════════════\n  ${t}\n══════════════════════════════════════════════════════════════\n`;

async function ensureAssetsAndSeed() {
  console.log(box('STEP 0 · Sample (SIMULATED) assets + knowledge base'));
  await import('./generate-demo-assets.js');
  const db = getSovereignDB();
  const seed = await seedSovereign();

  const reportPath = path.join(DATA_DIR, 'pump-p101-inspection-report.txt');
  const alreadyInKb = db.listDocuments().some((d) => d.filename === 'pump-p101-inspection-report.txt' && d.status === 'ready');
  if (!alreadyInKb) {
    const ing = await ingestSovereignDocument({
      filePath: reportPath,
      filename: 'pump-p101-inspection-report.txt',
      user: INSPECTOR,
      classification: 'INTERNAL',
      department: 'Inspection & Reliability',
      version: '2026-09-10',
    });
    console.log(line('inspection report ingested', `${ing.success ? 'ok' : 'FAIL'} · ${ing.chunks ?? '?'} chunks`));
  } else {
    console.log(line('inspection report', 'already in KB (skip)'));
  }
  for (const r of seed) console.log(line(r.filename, r.skipped ? 'already ingested' : `ingested · ${r.chunks} chunks`));
}

function printGateQuestion() {
  console.log(box('STEP 1 · Task classification (deterministic, offline)'));
  const q = 'Draft an approval note for P-101 bearing replacement driven by inspection report INSP-2026-0911-02';
  const c = classifier.classify({ question: q });
  console.log(line('query', q.slice(0, 80) + '…'));
  console.log(line('taskType', `${c.taskType} (${c.modality})`, 34));
  console.log(line('reason', c.reason, 34));
  const gate = taskGate({ input: q, classification: c, user: INSPECTOR });
  console.log(line('risk', `${gate.risk.risk} — ${gate.risk.reason}`, 34));
  console.log(line('requiresApproval', String(gate.requiresApproval), 34));
  console.log(line('workflow', routeWorkflow(c.taskType), 34));
  console.log(line('plan', (buildPlan(c.taskType, gate).steps || []).map(s => s.step).join(' → '), 34));
  return { q, c };
}

async function printRouterVerdict(q, c) {
  console.log(box('STEP 2 · Model auto-routing (task → model)'));
  const router = modelRouter();
  const decision = await router.decide({ question: q, taskType: c.taskType, modality: c.modality });
  console.log(line('routed model', decision.decisionModelId || '—', 34));
  console.log(line('role / status', `${decision.decisionRole} / ${decision.decisionStatus}`, 34));
  console.log(line('capabilities', decision.decisionCapabilities.join(', '), 34));
  console.log(line('reason', decision.reason, 34));
  if (decision.available) console.log(line('presentation', 'model is live on the local gateway — real inference enabled', 34));
  else console.log(line('honest fallback', 'no local model → deterministic workbench packet (never fabricated)', 34));
  return decision;
}

async function runGatedWorkflow(q) {
  console.log(box('STEP 3 · Human-in-the-loop: gate then approve'));
  const start = await orchestrator().start({ user: INSPECTOR, sessionId: 'demo-flagship', input: q });
  console.log(line('task status', start.status, 34));
  console.log(line('task id', start.taskId, 34));
  console.log(line('approval gate', `${start.gate.risk.risk} risk (${start.gate.risk.reason})`, 34));
  console.log(line('no AI output produced yet', start.packet?.note || '—', 34));

  console.log('\n  — RBAC probe: inspector tries to self-approve —');
  const lame = await orchestrator().proceedAfterApproval({ taskId: start.taskId, approver: INSPECTOR, decision: 'approved' });
  console.log(line('result', `${lame.ok ? 'UNEXPECTED PASS' : 'DENIED 403'} · ${lame.reason}`, 34));

  console.log('\n  — Manager approves (role checked INSIDE the orchestrator) —');
  const res = await orchestrator().proceedAfterApproval({ taskId: start.taskId, approver: MANAGER, note: 'Justification verified. Approved for drafting.', decision: 'approved' });
  console.log(line('status', res.status, 34));
  console.log(line('generated', String(res.generated), 34));
  if (res.model) console.log(line('model used', res.model, 34));
  if (res.status === 'model_unavailable') {
    console.log(line('honest message', res.message.split('\n')[0].slice(0, 70), 34));
    if (res.packet) {
      console.log(line('deterministic packet', `gathered=${res.packet.gathered?.length} · calc=${res.packet.calculations?.length} · comparisons=${res.packet.comparisons?.length}`, 34));
      console.log('  packet sources:');
      for (const g of (res.packet.gathered || []).slice(0, 5)) console.log(`      · ${g.document} (page ${g.page})`);
    }
  }
  if (res.artifact) console.log(line('deliverable', `${res.artifact.name} @ ${res.artifact.downloadPath}`, 34));
  if (res.answer && !res.artifact) console.log(line('answer', `${String(res.answer).slice(0, 120)}…`, 34));

  console.log('\n  — Agent trace (what happened, in order) —');
  const trace = res.trace || res.packet?.trace || [];
  for (const t of trace) {
    const tool = t.model ? `model=${t.model}` : t.tool ? `tool=${t.tool}` : '';
    const out = t.outcome?.error ? `✗ ${t.outcome.error}` : t.outcome?.ok ? '✓' : (t.note ? t.note : '');
    console.log(`      ${String(t.step || t.stepIndex).padEnd(18)} ${tool.padEnd(20)} ${t.elapsedMs ? `${t.elapsedMs}ms`.padEnd(8) : ''} ${out}`.replace(/\s+$/, ''));
  }
  return res;
}

async function printSovereigntyReport() {
  console.log(box('STEP 4 · Sovereignty proof (the actual claim, not a statement)'));
  const db = getSovereignDB();
  const chain = db.verifyAuditChain();
  const events = db.listSovereigntyEvents({ limit: 500 });
  const byKind = events.reduce((acc, e) => { acc[e.eventType] = (acc[e.eventType] || 0) + 1; return acc; }, {});
  console.log(line('audit chain', `${chain.intact ? 'INTACT ✓' : 'BROKEN'} · ${chain.count} entries`, 34));
  console.log(line('sovereignty events counted', JSON.stringify(byKind), 34));
  const modelCalls = events.filter((e) => e.eventType === 'local_model');
  console.log(line('local model calls', modelCalls.length, 34));
  for (const m of modelCalls.slice(-3)) console.log(`      · ${m.provider || m.detail?.model || '?'} → ${m.detail?.elapsedMs ?? ''}ms`);
  const blocked = events.filter((e) => e.eventType === 'egress_block');
  console.log(line('OUTBOUND / egress blocks', blocked.length === 0 ? '0 (nothing left the host)' : `${blocked.length} blocked`, 34));
  for (const b of blocked.slice(-3)) console.log(`      ! EGRESS BLOCKED → ${b.destination}`);

  const audit = db.listAudit({ limit: 200 });
  const cats = audit.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {});
  console.log(line('audit categories (recent)', JSON.stringify(cats), 34));
}

async function main() {
  console.log(box('SOVEREIGN AI WORKBENCH — FLAGSHIP EXAMPLE RUN'));
  await ensureAssetsAndSeed();
  const { q, c } = printGateQuestion();
  await printRouterVerdict(q, c);
  await runGatedWorkflow(q);
  await printSovereigntyReport();
  console.log(box('Done · start the UI with `npm start` (API :5000) + `frontend npm run dev` (UI :5173) → http://localhost:5173/workbench'));
}

main().catch((err) => { console.error('Flagship demo failed:', err); process.exit(1); });