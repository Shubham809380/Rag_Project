// Generate the sample (SIMULATED) datasets used by the SIH26117 demo.
//
// Everything here is synthetic and clearly labelled. No MRPL confidential data
// is used or implied. Run:  npm run assets    (idempotent; --force to rebuild)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'datasets');
const force = process.argv.includes('--force');

const INSPECTION_REPORT = `INSPECTION REPORT — PUMP SERVICE CHECK (SIMULATED DATA)
=====================================================================
REPORT REF: INSP-2026-0911-02        DATE: 2026-09-10
EQUIPMENT:  CENTRIFUGAL PUMP P-101  |  UNIT: SECTION-2, SULPHUR BLOCK
TYPE:       ROTATING EQUIPMENT CONDITION SURVEY (NON-INTRUSIVE)
CLASSIFICATION: INTERNAL (SIMULATED)   |  INSPECTOR: A. Sharma

1. FINDINGS SUMMARY
   1.1 Bearing housing temperature trending up to 54 deg C (limit 50 deg C).
   1.2 Vibration velocity 5.2 mm/s at DE bearing (limit 4.5 mm/s).
   1.3 Minor seal weep observed at the stuffing box (approx 1 drop / 30 s).
   1.4 No coupling wear indicators; alignment within tolerance (±0.05 mm).

2. RECOMMENDED ACTIONS
   2.1 Schedule bearing replacement with LOTO per SOP-07 section 4.2.
   2.2 Before work: validate cold-work permit, isolate and tag both isolation
       valves, cool rotor until bearing housing is below 50 deg C.
   2.3 Fire watch present for the duration of work.
   2.4 Spare estimate crosses the 12 Lakh INR maintenance limit -> an approval
       note with justification is required before procurement (POL-12 2.2/2.3).

3. ADDITIONAL NOTES
   3.1 Re-inspect temperature after 72 hours if operation must continue.
   3.2 This is synthetic sample data for demonstration only — not a real plant
       record.
`;

const TELEMETRY_SAMPLE = `timestamp,equipment,parameter,value,unit
2026-09-01T08:00:00,B-101,vibration_de,4.1,mm_s
2026-09-01T08:00:00,B-101,vibration_nde,3.6,mm_s
2026-09-01T08:00:00,B-101,temperature_de,42.0,deg_c
2026-09-01T08:00:00,B-101,temperature_nde,41.2,deg_c
2026-09-01T12:00:00,B-101,vibration_de,4.2,mm_s
2026-09-01T12:00:00,B-101,vibration_nde,3.7,mm_s
2026-09-01T12:00:00,B-101,temperature_de,43.1,deg_c
2026-09-01T12:00:00,B-101,temperature_nde,42.0,deg_c
2026-09-02T08:00:00,B-101,vibration_de,4.4,mm_s
2026-09-02T08:00:00,B-101,vibration_nde,3.9,mm_s
2026-09-02T08:00:00,B-101,temperature_de,44.0,deg_c
2026-09-02T08:00:00,B-101,temperature_nde,43.0,deg_c
2026-09-02T12:00:00,B-101,vibration_de,4.6,mm_s
2026-09-02T12:00:00,B-101,vibration_nde,4.0,mm_s
2026-09-02T12:00:00,B-101,temperature_de,45.2,deg_c
2026-09-02T12:00:00,B-101,temperature_nde,44.1,deg_c
2026-09-03T08:00:00,B-101,vibration_de,4.9,mm_s
2026-09-03T08:00:00,B-101,vibration_nde,4.2,mm_s
2026-09-03T08:00:00,B-101,temperature_de,47.0,deg_c
2026-09-03T08:00:00,B-101,temperature_nde,45.5,deg_c
2026-09-03T12:00:00,B-101,vibration_de,5.2,mm_s
2026-09-03T12:00:00,B-101,vibration_nde,4.5,mm_s
2026-09-03T12:00:00,B-101,temperature_de,48.4,deg_c
2026-09-03T12:00:00,B-101,temperature_nde,46.7,deg_c
2026-09-04T08:00:00,B-101,vibration_de,5.6,mm_s
2026-09-04T08:00:00,B-101,vibration_nde,4.8,mm_s
2026-09-04T08:00:00,B-101,temperature_de,50.1,deg_c
2026-09-04T08:00:00,B-101,temperature_nde,48.3,deg_c
2026-09-04T12:00:00,B-101,vibration_de,5.9,mm_s
2026-09-04T12:00:00,B-101,vibration_nde,5.1,mm_s
2026-09-04T12:00:00,B-101,temperature_de,52.0,deg_c
2026-09-04T12:00:00,B-101,temperature_nde,49.8,deg_c
2026-09-05T08:00:00,B-101,vibration_de,6.2,mm_s
2026-09-05T08:00:00,B-101,vibration_nde,5.3,mm_s
2026-09-05T08:00:00,B-101,temperature_de,54.0,deg_c
2026-09-05T08:00:00,B-101,temperature_nde,51.2,deg_c
`;

function coverConsole(output, name, exists, any) {
  if (!any) return;
  console.log(`${exists ? 'exists' : 'wrote '} ${path.relative(path.resolve(__dirname, '..'), output)}`);
}

async function buildTagImage(output) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(760, 280);
  const g = canvas.getContext('2d');
  // Mimic a slightly worn laminated tag.
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
  g.fillText('SIMULATED EQUIPMENT TAG — DEMO ONLY', 44, 248);
  fs.writeFileSync(output, canvas.toBuffer('image/png'));
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const exists = {};
  for (const name of ['pump-p101-scanned-tag.png', 'pump-p101-inspection-report.txt', 'telemetry_B101_vibration.csv']) {
    exists[name] = fs.existsSync(path.join(DATA_DIR, name));
  }

  const reportOut = path.join(DATA_DIR, 'pump-p101-inspection-report.txt');
  if (force || !exists['pump-p101-inspection-report.txt']) fs.writeFileSync(reportOut, INSPECTION_REPORT, 'utf8');

  const csvOut = path.join(DATA_DIR, 'telemetry_B101_vibration.csv');
  if (force || !exists['telemetry_B101_vibration.csv']) fs.writeFileSync(csvOut, TELEMETRY_SAMPLE, 'utf8');

  const tagOut = path.join(DATA_DIR, 'pump-p101-scanned-tag.png');
  if (force || !exists['pump-p101-scanned-tag.png']) await buildTagImage(tagOut);

  console.log('datasets/  (SIMULATED — labelled for demonstration only):');
  coverConsole(reportOut, 'inspection report', exists['pump-p101-inspection-report.txt'], true);
  coverConsole(csvOut, 'telemetry csv', exists['telemetry_B101_vibration.csv'], true);
  coverConsole(tagOut, 'scanned tag png', exists['pump-p101-scanned-tag.png'], true);
  console.log('\nNext: node scripts/demo-flagship.js   (flagship approved-note demo)');
}

main().catch((e) => { console.error('assets failed:', e); process.exit(1); });