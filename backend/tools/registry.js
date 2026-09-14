import sovereign from '../config/sovereign.js';
import { policy } from '../security/policy.js';
import { auditService, CATEGORY } from '../security/audit.js';
import logger from '../utils/logger.js';

const LOG = 'ToolRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// ToolRegistry — every tool is declared with full metadata and is executed
// through here so that policy, timeouts, limits and audit are applied uniformly.
// ─────────────────────────────────────────────────────────────────────────────

export class ToolError extends Error {
  constructor(message, { code = 'TOOL_ERROR', details = {}, retryable = false } = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    if (!tool || !tool.name) throw new Error('Tool requires a name');
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name) { return this.tools.get(name); }

  all() { return [...this.tools.values()].map(t => this.describe(t)); }

  describe(t) {
    return {
      name: t.name,
      description: t.description,
      version: t.version || '1',
      permissionLevel: t.permissionLevel ?? 0,
      timeoutMs: t.timeoutMs || 30000,
      resourceLimit: t.resourceLimit || null,
      inputSchema: t.inputSchema || { type: 'object', properties: {} },
      outputSchema: t.outputSchema || { type: 'object' },
      requiresApprovalRisk: t.requiresApprovalRisk || 'low',
    };
  }

  async execute(name, args = {}, ctx = {}) {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolError(`Unknown tool: ${name}`, { code: 'UNKNOWN_TOOL' });

    // ── Authorization gate ───────────────────────────────────────────────
    const perm = policy().canUseTool(ctx.user, tool);
    if (!perm.allowed) {
      auditService().record({ category: CATEGORY.SECURITY, action: 'tool_denied', severity: 'warning', user: ctx.user, details: { tool: name, reason: perm.reason } });
      throw new ToolError(`Tool "${name}" denied: ${perm.reason}`, { code: 'TOOL_DENIED' });
    }

    // ── Sandbox / network policy interplay ───────────────────────────────
    if (tool.needsNetwork && !policy().isExternalNetworkAllowed().allowed) {
      throw new ToolError(`Tool "${name}" requires external network, which is disabled in this domain.`, { code: 'NETWORK_DISABLED' });
    }

    // ── Depth guard (agents use this to prevent runaway loops) ───────────
    if (typeof ctx.toolDepth === 'number' && ctx.toolDepth > sovereign.agent.maxToolCalls) {
      throw new ToolError(`Agent exceeded the maximum of ${sovereign.agent.maxToolCalls} tool calls.`, { code: 'AGENT_TOOL_LIMIT' });
    }

    const timeoutMs = tool.timeoutMs || 30000;
    const started = Date.now();
    auditService().record({ category: CATEGORY.TOOL, action: 'tool_start', severity: 'info', user: ctx.user, sessionId: ctx.sessionId, details: { tool: name, taskId: ctx.taskId, args: safeArgs(tool, args) } });

    try {
      const result = await withTimeout(tool.run.bind(tool), { args, ctx, tool, timeoutMs });
      const elapsed = Date.now() - started;
      auditService().record({ category: CATEGORY.TOOL, action: 'tool_done', severity: 'info', user: ctx.user, sessionId: ctx.sessionId, details: { tool: name, taskId: ctx.taskId, ok: !result?.error, elapsedMs: elapsed, resultSummary: summarize(result) } });
      return { tool: name, ok: true, result, elapsedMs: elapsed };
    } catch (err) {
      const elapsed = Date.now() - started;
      auditService().record({ category: CATEGORY.TOOL, action: 'tool_error', severity: 'warning', user: ctx.user, sessionId: ctx.sessionId, details: { tool: name, taskId: ctx.taskId, elapsedMs: elapsed, code: err.code || err.name, message: err.message?.slice(0, 300) } });
      if (err instanceof ToolError) throw err;
      throw new ToolError(err.message || 'Tool execution failed', { code: err.code || 'TOOL_ERROR', retryable: true });
    }
  }
}

function safeArgs(tool, args) {
  // Never log raw document contents pushed through tools.
  const keys = Object.keys(args || {});
  const summary = {};
  for (const k of keys) {
    const v = args[k];
    if (typeof v === 'string' && v.length > 200) summary[k] = `${v.slice(0, 200)}…(${v.length} chars)`;
    else if (Array.isArray(v)) summary[k] = `[array:${v.length}]`;
    else if (v && typeof v === 'object') summary[k] = '[object]';
    else summary[k] = v;
  }
  return summary;
}

function summarize(result) {
  if (result == null) return null;
  const sample = {};
  for (const k of ['rows', 'results', 'sources', 'citations']) {
    if (result[k] && Array.isArray(result[k])) sample[k] = result[k].length;
  }
  if (typeof result.answer === 'string') sample.answer = `${result.answer.slice(0, 120)}…`;
  if (typeof result.text === 'string') sample.textLen = result.text.length;
  if (result.error) sample.error = String(result.error).slice(0, 200);
  return Object.keys(sample).length ? sample : null;
}

function withTimeout(fn, { args, ctx, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ToolError(`Tool timed out after ${timeoutMs}ms`, { code: 'TOOL_TIMEOUT', retryable: true }));
    }, timeoutMs);
    (async () => {
      try {
        const res = await fn.call(null, args, ctx);
        clearTimeout(timer);
        resolve(res);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    })();
  });
}

let _registry = null;
export const toolRegistry = () => (_registry || (_registry = new ToolRegistry()));
export default toolRegistry;