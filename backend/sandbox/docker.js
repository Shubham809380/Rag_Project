import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sovereign from '../config/sovereign.js';
import { guardCode, guardTests } from './codeguard.js';
import logger from '../utils/logger.js';

const LOG = 'CodeSandbox';
const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// CodeSandbox — isolated execution of AI-generated code.
//
// * Static guard FIRST (see codeguard.js).
// * ONE container per execution, NEW each time, `--network none`.
// * -m memory, --cpus CPU, timeout enforced at the OS level.
// * stdout/stderr/exitcode captured and returned; host filesystem isolated to
//   a per-run scratch dir (read-only source, read-write /work).
// * If Docker is unavailable we REFUSE to run code rather than falling back to
//   an unprotected host `child_process` — UNLESS SOVEREIGN_HOST_FALLBACK=true
//   is set explicitly. The fallback still applies the static guard and time
//   limits, but runs on the host Python interpreter (not process-isolated) and
//   every result is labelled `fallback: 'host'` so callers can stay honest.
// ─────────────────────────────────────────────────────────────────────────────

const RUN_TESTS_SCRIPT = `import importlib.util, sys
# 1) run the user program first (python main.py semantics) so its prints appear
src = open('/work/main.py').read()
try:
    exec(compile(src, 'main.py', 'exec'), {'__name__': '__main__'})
except SystemExit:
    pass
# 2) then load the module for the test suite (as both 'main' and 'solution')
spec = importlib.util.spec_from_file_location('main', '/work/main.py')
main = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main)
sys.modules['main'] = main
sys.modules['solution'] = main
try:
    exec(open('/work/tests.py').read(), {**vars(main), 'main': main, 'solution': main})
    print('ALL_TESTS_PASSED')
except AssertionError as e:
    print('TEST_FAILED:', e); sys.exit(2)
except Exception as e:
    print('TEST_ERROR:', type(e).__name__, e); sys.exit(3)
`;

const RUN_TESTS_SCRIPT_HOST = RUN_TESTS_SCRIPT.replaceAll('/work/', '');

async function dockerAvailable() {
  try {
    const { stdout } = await execFileAsync('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 5000 });
    return !!stdout.trim();
  } catch {
    return false;
  }
}

let _dockerOk = null;
export async function isDockerAvailable(force = false) {
  if (_dockerOk === null || force) _dockerOk = await dockerAvailable();
  return _dockerOk;
}

export const SANDBOX_UNAVAILABLE = 'Local code sandbox (Docker) is not available on this host. Code execution is refused — no unprotected host execution fallback is used.';

// Resolve a Python 3 interpreter on this host for the opt-in fallback.
let _hostPython = null;
function hostPython() {
  if (_hostPython !== null) return _hostPython;
  const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const c of candidates) {
    try {
      const v = execFileSync(c, ['-c', 'import sys; print(sys.version_info[0])'], { timeout: 8000, stdio: 'pipe' }).toString().trim();
      if (v === '3') { _hostPython = c; return c; }
    } catch { /* try next candidate */ }
  }
  _hostPython = false;
  return false;
}

function runContainer(image, args, { timeoutMs, cwd }) {
  return new Promise((resolve) => {
    const child = execFile('docker', ['run', '--rm', '--network', 'none', '-m', sovereign.sandbox.memoryLimit, '--cpus', sovereign.sandbox.cpuLimit, ...args], { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const exitCode = err?.code ?? 0;
      const timedOut = /ERR_CHILD_PROCESS_STDIO_MAXBUFFER|ETIMEDOUT/.test(err?.message || '') || (err?.killed && err?.signal === 'SIGTERM');
      resolve({ exitCode, stdout: String(stdout || ''), stderr: String(stderr || ''), timedOut, error: err?.message || null });
    });
    child.on('error', (e) => resolve({ exitCode: -1, stdout: '', stderr: '', error: e.message }));
  });
}

// Execute python source + optional test source in an isolated container.
export async function runPython({ code, tests = null, files = {}, timeoutMs = sovereign.sandbox.timeoutMs, image = sovereign.sandbox.dockerImage } = {}) {
  const guard = guardCode(code);
  if (!guard.ok) return { ok: false, error: 'Static code guard rejected the program.', issues: guard.issues };

  const available = await isDockerAvailable();
  if (!available) {
    if (sovereign.sandbox.hostFallback) {
      logger.warn(LOG, 'Docker unavailable — using host Python fallback (unprotected process, guarded code only)');
      return runHostPython({ code, tests, files, timeoutMs });
    }
    return { ok: false, error: SANDBOX_UNAVAILABLE };
  }

  const runId = crypto.randomUUID();
  const scratch = path.join(sovereign.paths.workspaceDir, `run-${runId}`);
  fs.mkdirSync(path.join(scratch, 'work'), { recursive: true });

  const mainPath = path.join(scratch, 'work', 'main.py');
  fs.writeFileSync(mainPath, code);
  for (const [name, content] of Object.entries(files || {})) {
    const safe = path.basename(name);
    fs.writeFileSync(path.join(scratch, 'work', safe), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }

  const mount = `${scratch}/work:/work:rw`;
  let result;
  try {
    let testResult = null;
    if (tests) {
      const tGuard = guardTests(tests);
      if (!tGuard.ok) return { ok: false, error: 'Static test guard rejected the test suite.', issues: tGuard.issues };
      const testPath = path.join(scratch, 'work', 'tests.py');
      fs.writeFileSync(testPath, tests);
      fs.writeFileSync(path.join(scratch, 'work', 'run_tests.py'), RUN_TESTS_SCRIPT);
      result = await runContainer(image, ['-v', mount, '-w', '/work', image, 'python', 'run_tests.py'], { timeoutMs, cwd: scratch });
      testResult = result;
    } else {
      result = await runContainer(image, ['-v', mount, '-w', '/work', image, 'python', 'main.py'], { timeoutMs, cwd: scratch });
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  if (result.timedOut) return { ok: false, error: `Sandbox timed out after ${timeoutMs}ms`, stdout: result.stdout, stderr: result.stderr };
  if (result.exitCode !== 0) return { ok: false, error: `Program exited with code ${result.exitCode}`, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };

  return { ok: true, stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
}

// Host Python fallback — ONLY reached when SOVEREIGN_HOST_FALLBACK=true and
// Docker is unavailable. Applies the same static guard and time limit, but runs
// in a plain host `python` process (no process/network isolation). Every result
// is marked `fallback: 'host'` so callers can display it honestly.
async function runHostPython({ code, tests = null, files = {}, timeoutMs }) {
  const py = hostPython();
  if (!py) return { ok: false, error: 'Host fallback enabled, but no Python 3 interpreter was found on this host.' };

  const runId = crypto.randomUUID();
  const scratch = path.join(sovereign.paths.workspaceDir, `hostrun-${runId}`);
  fs.mkdirSync(scratch, { recursive: true });

  const guard = guardCode(code);
  if (!guard.ok) return { ok: false, error: 'Static code guard rejected the program.', issues: guard.issues };

  const mainPath = path.join(scratch, 'main.py');
  fs.writeFileSync(mainPath, code);
  for (const [name, content] of Object.entries(files || {})) {
    const safe = path.basename(name);
    fs.writeFileSync(path.join(scratch, safe), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }

  const script = tests ? 'run_tests.py' : 'main.py';
  let result;
  try {
    if (tests) {
      const tGuard = guardTests(tests);
      if (!tGuard.ok) return { ok: false, error: 'Static test guard rejected the test suite.', issues: tGuard.issues };
      fs.writeFileSync(path.join(scratch, 'tests.py'), tests);
      fs.writeFileSync(path.join(scratch, 'run_tests.py'), RUN_TESTS_SCRIPT_HOST);
    }
    result = await execFileAsync(py, ['-I', script], { cwd: scratch, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 })
      .then(({ stdout, stderr }) => ({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || ''), exitCode: 0 }))
      .catch((err) => {
        const timedOut = /ETIMEDOUT|ERR_CHILD_PROCESS_STDIO_MAXBUFFER/.test(err?.message || '') || (err?.killed && err?.signal === 'SIGTERM');
        return {
          ok: false,
          exitCode: err?.code ?? -1,
          stdout: String(err?.stdout || ''),
          stderr: String(err?.stderr || ''),
          timedOut,
          error: timedOut ? `Sandbox timed out after ${timeoutMs}ms` : (err?.message || 'host python failed'),
        };
      });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  if (!result.ok && result.timedOut) return { ok: false, error: result.error, stdout: result.stdout, stderr: result.stderr, fallback: 'host' };
  if (!result.ok && result.exitCode !== 0) return { ok: false, error: `Program exited with code ${result.exitCode}`, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, fallback: 'host' };
  return { ok: true, stdout: result.stdout, stderr: result.stderr, exitCode: 0, fallback: 'host' };
}

// Convenience: execute code + named tests, returning pass/fail summary.
export async function runPythonWithTests({ code, tests }) {
  const r = await runPython({ code, tests });
  if (!r.ok) return r;
  return { ...r, ok: true, passed: true, summary: r.stdout.split('\n').filter(Boolean).slice(-20) };
}