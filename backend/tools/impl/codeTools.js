import { runPython, runPythonWithTests, SANDBOX_UNAVAILABLE } from '../../sandbox/docker.js';
import { ToolError } from '../registry.js';

export const executePython = {
  name: 'execute_python',
  description: 'Execute isolated Python 3 code inside a one-shot Docker container (no network, memory/CPU capped, static code guard). Output returned to the agent.',
  permissionLevel: 2,
  timeoutMs: 120000,
  needsNetwork: false,
  inputSchema: { type: 'object', properties: { code: { type: 'string' }, files: { type: 'object' } } },
  outputSchema: { type: 'object', properties: { exitCode: { type: 'number' }, stdout: { type: 'string' }, stderr: { type: 'string' } } },
  async run(args, ctx) {
    if (!args.code) throw new ToolError('execute_python requires "code"', { code: 'INVALID_ARGS' });
    const r = await runPython({ code: args.code, files: args.files });
    if (!r.ok) throw new ToolError(r.error, { code: 'SANDBOX_UNAVAILABLE', details: { issues: r.issues, stdout: r.stdout, stderr: r.stderr }, retryable: false });
    return { exitCode: r.exitCode, stdout: r.stdout.slice(0, 100_000), stderr: r.stderr.slice(0, 50_000) };
  },
};

export const runTests = {
  name: 'run_tests',
  description: 'Run a hand-written assertion test-suite against main.py inside the sandbox. Tests use assert on functions imported as main.<name>. Pass/fail summary returned.',
  permissionLevel: 2,
  timeoutMs: 120000,
  needsNetwork: false,
  inputSchema: { type: 'object', properties: { code: { type: 'string' }, tests: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { ok: { type: 'boolean' }, summary: { type: 'array' } } },
  async run(args, ctx) {
    if (!args.code || !args.tests) throw new ToolError('run_tests requires "code" and "tests"', { code: 'INVALID_ARGS' });
    const r = await runPythonWithTests({ code: args.code, tests: args.tests });
    if (!r.ok && r.error === SANDBOX_UNAVAILABLE) throw new ToolError(SANDBOX_UNAVAILABLE, { code: 'SANDBOX_UNAVAILABLE' });
    if (!r.ok && !r.passed) return { ok: false, skipped: true, reason: r.error, stdout: r.stdout };
    return { ok: true, summary: r.summary || [] };
  },
};