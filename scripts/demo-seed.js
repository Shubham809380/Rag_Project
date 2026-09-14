import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import { ingestSovereignDocument } from '../backend/rag/sovereignPipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, '..', 'sovereign', 'seed');
const SEED_USER = { id: 'demo-operator', email: 'operator@plant.local', name: 'Demo Operator', role: 'inspector' };

function buildEquipmentWorkbookBuffer() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Equipment', 'VibrationLimit_mm_s', 'Reading_mm_s'],
    ['B-101', 4.5, 5.2],
    ['P-102', 4.5, 2.1],
    ['HT-201', 6.8, 6.7],
  ]), 'Assets');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export const SEED_DOCS = [
  {
    filename: 'sop-07-blower-bearing.txt',
    classification: 'INTERNAL',
    department: 'Mechanical Maintenance',
    text: `SOP-07: Blower B-101 Bearing Replacement
Classification: INTERNAL  Department: Mechanical Maintenance  Version: 1

1. SCOPE
This procedure applies to replacement of the coupling-end and non-drive-end
anti-friction bearings of Blower B-101, Section-2, Sulphur Block.

2. SPARE PART LIMIT
2.1 The maintenance limit for bearing replacement spares is 12 Lakh INR per
financial year per unit. Any single item exceeding this limit requires an
approval note with a justification summary.
2.2 In an emergency, the workbench agent may DRAFT the approval note but the
note must be approved by the supervisor before any procurement action.

3. PREVENTIVE MAINTENANCE FREQUENCY
3.1 Greasing of B-101 bearings: every 90 days.
3.2 Coupling alignment check: every 180 days.
3.3 Bearing temperature trend review: monthly.
3.4 Vibration signature survey: quarterly.

4. SAFETY REQUIREMENTS
4.1 The work must follow a validated Work Permit (cold work) before starting.
4.2 Both isolation valves to be closed and tagged; rotor must be left to cool
until bearing housing temperature is below 50 degree Celsius.
4.3 Fire watch to remain present for the duration of the work.

5. ACCEPTANCE CRITERIA
5.1 Post-installation axial end play within 0.05 mm.
5.2 Vibration velocity below 4.5 mm/s at rated speed.
5.3 Bearing temperature stabilizes below the recommended OEM limit.`,
  },
  {
    filename: 'pol-soft-limit-policy.txt',
    classification: 'INTERNAL',
    department: 'Finance',
    text: `Policy POL-12: Soft Capital Spend Approval Limits
Classification: INTERNAL  Department: Finance  Version: 3

1. DEFINITIONS
1.1 "Soft spend" covers spares, consumables and service contracts below the
major capital threshold.
1.2 The reviewing authority for approval notes is the shift/unit supervisor;
for sums above 25 Lakh INR the Plant Manager must co-sign.

2. LIMITS
2.1 Up to 5 Lakh INR: requisitioning authority approves.
2.2 5 Lakh to 12 Lakh INR: supervisor approval required (approval note).
2.3 Above 12 Lakh INR: plant manager approval + written justification summary
of alternatives considered.
2.4 Emergency runs: approval note may be drafted retroactively within 48 hours.

3. WORKBENCH USE
3.1 The sovereign workbench may draft approval notes but may never authorize
spend on its own. A human approver must sign every approval note.
3.2 The approval note must cite this policy clause and the governing SOP.`,
  },
  {
    filename: 'safety-loto-checklist.txt',
    classification: 'CONFIDENTIAL',
    department: 'HSE',
    text: `SOP-19: Lockout/Tagout Pre-Job Checklist
Classification: CONFIDENTIAL  Department: HSE  Version: 2

1. REQUIRED CHECKS (all must be complete before work starts)
1.1 Isolation: all energy sources (electrical, pneumatic, mechanical)
isolated and locked with a personal lock.
1.2 Verification: attempt a normal start to confirm zero energy, then return
the control to "off" and tag the isolation point.
1.3 Conditions: rotor cool (bearing housing below 50 deg C), area ventilated,
fire watch present for grinding/hot work.
1.4 Documentation: work permit (cold or hot as applicable) countersigned.

2. POST-JOB CHECKS
2.1 Removal of all LOTO devices by the issuing person only.
2.2 Walk-down of the affected area before re-energizing.
2.3 Record the checklist reference in the shift log.

3. EXCEPTIONS
3.1 Only the authorised person who fitted a lock may remove it.
3.2 Any deviation requires the supervisor to sign a deviation note,
which is logged in the sovereign audit trail.`,
  },
  {
    filename: 'equipment-list.xlsx',
    classification: 'INTERNAL',
    department: 'Reliability',
    buffer: buildEquipmentWorkbookBuffer(),
  },
];

export async function seedSovereign({ force = false } = {}) {
  const db = getSovereignDB();
  const existing = db.listDocuments();
  const already = (name) => existing.some((d) => d.filename === name && d.status === 'ready');

  fs.mkdirSync(SEED_DIR, { recursive: true });
  const results = [];
  for (const doc of SEED_DOCS) {
    if (!force && already(doc.filename)) {
      results.push({ filename: doc.filename, skipped: true });
      continue;
    }
    const filePath = path.join(SEED_DIR, doc.filename);
    if (doc.buffer) fs.writeFileSync(filePath, doc.buffer);
    else fs.writeFileSync(filePath, doc.text, 'utf8');
    const res = await ingestSovereignDocument({
      filePath,
      filename: doc.filename,
      user: SEED_USER,
      classification: doc.classification,
      department: doc.department,
      version: '1',
    });
    fs.rmSync(filePath, { force: true });
    results.push({ filename: doc.filename, ...res });
  }
  return results;
}

// Node entry: `node scripts/demo-seed.js [--force]`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  const results = await seedSovereign({ force });
  for (const r of results) {
    console.log(r.skipped ? `skip  ${r.filename} (already ingested)` : `${r.success ? 'ok   ' : 'FAIL '} ${r.filename} → chunks=${r.chunks ?? '?'} provider=${r.embeddingProvider ?? '-'} ${r.error ?? ''}`);
  }
  if (results.every((r) => r.skipped || r.success)) console.log('\nSeed complete.');
  else process.exitCode = 1;
}