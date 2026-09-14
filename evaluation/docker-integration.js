import { isDockerAvailable } from '../backend/sandbox/docker.js';
import { runPython, runPythonWithTests } from '../backend/sandbox/docker.js';

// Docker-gated integration: only exercises the real code sandbox when Docker is
// reachable. On air-gapped hosts without Docker it SKIPS with the honest refusal
// path (which is itself verified in run-tests.js).

const docker = await isDockerAvailable(true);
console.log(`[docker-int] docker available: ${docker}`);

if (!docker) {
  console.log('  SKIPPED — no Docker on this host. Sandbox refuses code execution honestly (see run-tests #10).');
  process.exit(0);
}

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

// Pure compute runs isolated.
const r1 = await runPython({ code: 'print(6 * 7)' });
check('isolated python compute', r1.ok && r1.stdout.trim() === '42', (r1.stdout || '').trim());

// Hostile program is refused even with the host absent (deny by default).
const r2 = await runPython({ code: 'import socket; socket.socket().connect(("8.8.8.8", 80))' });
check('network python refused by guard', !r2.ok, r2.error);

// Code + tests path.
const r3 = await runPythonWithTests({
  code: 'def calc(qty, price):\n    return qty * price\n',
  tests: "assert calc(3, 4.5) == 13.5\nassert calc(0, 5) == 0\n",
});
check('sandboxed code + tests pass', r3.ok && r3.passed === true, r3.summary ? r3.summary.slice(-1)[0] : '');

console.log(`\n[docker-int] ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);