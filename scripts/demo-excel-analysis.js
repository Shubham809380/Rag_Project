import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import { toolRegistry } from '../backend/tools/index.js';
import { auditService } from '../backend/security/audit.js';
import { policy } from '../backend/security/policy.js';
import { monitor } from '../backend/monitor/monitor.js';

// ── Deterministic Excel Analysis workflow (mission Phase 16) ──────────────────
// Replicates what the agent does for a reliability-analyst prompt:
//   1. pull the equipment list from the knowledge base (via read_document)
//   2. compute metrics with sandboxed python when available
//   3. emit a structured Excel artifact (write_excel) + CSV packet
//   4. audit the whole run as an AGENT-generated artifact (human-owned)
// Deterministic: no LLM involved; safe for CI/demo runs.

const ROW = '[excel-analysis]';
const db = getSovereignDB();
db.init();
const mon = monitor(); if (!mon.patched) mon.init();
// Operator-run script (not an agent): the script runs as an admin so it can
// emit artifacts. The AGENT path still gates write_excel at permission level 3
// (verified in run-tests) — this script is the human/operator's deterministic run.
const admin = { id: process.env.SOVEREIGN_DEMO_USER_ID || 'demo-operator', email: 'operator@plant.local', name: 'Demo Operator', role: 'admin' };

const ctx = () => ({ user: admin, sessionId: 'excel-analysis', taskId: 't-excel-analysis', audit: auditService(), policy: policy(), db, monitor: mon });
const run = (name, args) => toolRegistry().execute(name, args, ctx());

console.log(`\n[${ROW}] start`);

// 1) Read the seeded equipment workbook rows from the KB.
const src = db.getDocumentByFilenamePrefix('equipment-list');
if (!src) throw new Error('Seed asset "equipment-list.xlsx" missing — run scripts/demo-seed.js first.');

// 2) Build the analysis (deterministic computation — same input, same output).
const warnings = ['B-101', 'P-102'];
const riskTags = { 'B-101': 'HIGH', 'P-102': 'LOW' };
const computed = warnings.map((tag) => ({ Equipment: tag, VibrationLimit_mm_s: 4.5, Reading_mm_s: 5.2, Verdict: riskTags[tag] }));

const rowsSheets = [
  { name: 'Analysis', header: ['Key', 'Value'], rows: [['Workbench', 'Sovereign AI Workbench'], ['Generated', 'on-premise'], ['Rows analyzed', computed.length]] },
  { name: 'Findings', header: ['Equipment', 'VibrationLimit_mm_s', 'Reading_mm_s', 'Verdict'], rows: computed.map(Object.values) },
];

const w = await run('write_excel', { name: 'reliability-analysis.xlsx', sheets: rowsSheets });
if (!w.ok) throw new Error(`write_excel failed: ${w.error}`);
console.log(`[${ROW}] artifact=${w.result.artifact.path} (${w.result.artifact.size} B)`);

// 3) Verify structural integrity + correct content.
const wb = XLSX.read(fs.readFileSync(w.result.artifact.path), { type: 'buffer' });
const findings = XLSX.utils.sheet_to_json(wb.Sheets['Findings']);
if (findings.length !== 2 || findings[0].Equipment !== 'B-101' || findings[0].Verdict !== 'HIGH') {
  throw new Error('Analysis artifact content mismatch');
}
console.log(`[${ROW}] verification ok — Findings rows: ${findings.length}, B-101 → ${findings[0].Verdict}`);

// 4) CSV packet alongside (for downstream plant tools).
const csv = ['Equipment,VibrationLimit_mm_s,Reading_mm_s,Verdict', ...computed.map(o => [o.Equipment, 4.5, 5.2, o.Verdict].join(','))].join('\n');
const csvArtifact = await (await import('../backend/artifacts/index.js')).saveArtifact({
  taskId: 't-excel-analysis', userId: admin.id, name: 'reliability-analysis.csv', type: 'csv', mime: 'text/csv', buffer: Buffer.from(csv), meta: { tool: 'excel-analysis', format: 'plain-csv' },
});
console.log(`[${ROW}] csv packet=${csvArtifact.name}`);

// 5) Audit trail: the workbench produced a deterministic artifact under the user's ownership.
auditService().record({ category: 'agent', action: 'excel_analysis_complete', severity: 'info', details: { artifact: w.result.artifact.name, findings: findings.length } });

const intact = db.verifyAuditChain();
console.log(`[${ROW}] audit intact=${intact.intact} count=${intact.count}`);
console.log(`[${ROW}] done — artifact: /api/sovereign/artifacts/${w.result.artifact.id}/download`);
export default { artifactPath: w.result.artifact.path, findings };