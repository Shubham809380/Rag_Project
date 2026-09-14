import { safeCalculate } from '../../services/tools/calculator.tool.js';
import { ToolError } from '../registry.js';

// Deterministic, eval()-free arithmetic for the agent. Never an LLM.
// The expression is captured as-is in the tool trace for auditability.

export const calculate = {
  name: 'calculate',
  description: 'Deterministic arithmetic evaluation (no eval, no network). Supports + - * / ^ % ( ), sqrt abs round floor ceil sin cos tan log log10 min max pi e.',
  permissionLevel: 0,
  timeoutMs: 5000,
  inputSchema: { type: 'object', properties: { expression: { type: 'string' }, units: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { expression: { type: 'string' }, result: { type: 'number' } } },
  async run(args, ctx) {
    if (!args.expression) throw new ToolError('calculate requires "expression"', { code: 'INVALID_ARGS' });
    const out = safeCalculate(args.expression);
    if (!out.success) throw new ToolError(out.error, { code: 'CALC_ERROR' });
    return { expression: args.expression, result: out.result, units: args.units || null };
  },
};