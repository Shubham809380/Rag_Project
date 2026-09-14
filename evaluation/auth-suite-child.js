// Sovereign Local Authentication — evaluation child suite.
// Expected to run inside a child process launched by auth-suite.js (isolated env).
import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import {
  ensureBootstrapAdmin,
  generateSovereignToken,
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  sovereignIdentity,
  verifySovereignToken,
  normalizeRole,
} from '../backend/security/sovereignAuth.js';
import { ROLES } from '../backend/security/rbac.js';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const db = getSovereignDB().init();
function mockReq(headers = {}, cookies = {}) {
  return { headers, cookies, socket: { remoteAddress: '127.0.0.1' } };
}

console.log('— Bootstrap admin —');
const admin = await ensureBootstrapAdmin();
check('bootstrap admin created', !!admin && admin.email === 'admin@plant.local', admin?.email);
check('bootstrap admin role', admin?.role === ROLES.ADMIN, admin?.role);
check('bootstrap admin forced change', admin?.mustChangePassword === true, admin?.mustChangePassword);
check('bootstrap idempotent (single admin row)', db.listUsers({ role: ROLES.ADMIN }).length === 1, db.listUsers({ role: ROLES.ADMIN }).length);

console.log('— Password policy —');
check('short rejected', validatePasswordPolicy('short').ok === false);
check('no number rejected', validatePasswordPolicy('OnlyLettersHere!').ok === false);
check('strong accepted', validatePasswordPolicy('Str0ng!Passw0rd').ok === true);
check('empty rejected', validatePasswordPolicy('')?.ok === false);

console.log('— Password hashing —');
const h = await hashPassword('TempP@ss1234');
check('hash not plaintext', h !== 'TempP@ss1234' && h.startsWith('$2'));
check('verify correct', await verifyPassword('TempP@ss1234', h));
check('verify wrong', !(await verifyPassword('WrongPass1', h)));

console.log('— JWT token + identity —');
const tok = generateSovereignToken(admin);
const decoded = verifySovereignToken(tok);
check('token verify + sovereign flag', !!decoded && decoded.sovereign === true);
check('token carries role', decoded?.role === ROLES.ADMIN, decoded?.role);
check('cookie identity resolves', sovereignIdentity(mockReq({}, { sovereign_token: tok }))?.email === 'admin@plant.local');

console.log('— User management —');
const analyst = db.createUser({
  employeeId: 'EMP-1001', fullName: 'Ravi Kumar', email: 'ravi@plant.local',
  department: 'Maintenance', role: ROLES.ANALYST, passwordHash: h, mustChangePassword: true,
});
check('create analyst', !!analyst && analyst.employee_id === 'EMP-1001');
check('role preserved', analyst.role === ROLES.ANALYST);
check('normalize junk -> analyst', normalizeRole('bogus') === ROLES.ANALYST);
const deactivated = db.updateUser(analyst.id, { status: 'inactive' });
check('deactivate user', deactivated?.status === 'inactive');

function runIsolated(label, src, overrides) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', src], {
    encoding: 'utf8', cwd: root,
    env: { ...process.env, NODE_ENV: 'development', DEMO_MODE: '', ...overrides },
  });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { parsed = null; }
  check(label, parsed?.ok === true, `${r.stdout}${r.stderr}`);
}

console.log('— Production header isolation (Phase 4/31) —');
runIsolated(
  'production denies forged headers even with DEMO_MODE=true',
  `import { sovereignIdentity } from './backend/security/sovereignAuth.js';
   const id = sovereignIdentity({ headers: { 'x-sovereign-role': 'admin', 'x-sovereign-user': 'evil@attacker.local' }, cookies: {}, socket: { remoteAddress: '127.0.0.1' } });
   console.log(JSON.stringify({ ok: id === null }));`,
  { NODE_ENV: 'production', DEMO_MODE: 'true' }
);

console.log('— DEMO_MODE header path (non-production only) —');
runIsolated(
  'non-prod + DEMO_MODE=true allows header identity',
  `import { sovereignIdentity } from './backend/security/sovereignAuth.js';
   const id = sovereignIdentity({ headers: { 'x-sovereign-role': 'engineer', 'x-sovereign-user': 'dev' }, cookies: {}, socket: { remoteAddress: '127.0.0.1' } });
   console.log(JSON.stringify({ ok: id && id.role === 'engineer' }));`,
  { NODE_ENV: 'development', DEMO_MODE: 'true' }
);
runIsolated(
  'non-prod default (DEMO_MODE unset) denies header identity',
  `import { sovereignIdentity } from './backend/security/sovereignAuth.js';
   const id = sovereignIdentity({ headers: { 'x-sovereign-role': 'admin' }, cookies: {}, socket: { remoteAddress: '127.0.0.1' } });
   console.log(JSON.stringify({ ok: id === null }));`,
  { NODE_ENV: 'development', DEMO_MODE: '' }
);

console.log(`\n========== RESULT: ${pass} passed, ${fail} failed ==========`);
if (fail) {
  console.log('Failures:', failures.join(', '));
  process.exit(1);
}
process.exit(0);