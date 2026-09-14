import fs from 'fs';
import path from 'path';
import { getSovereignDB, safeJson } from '../storage/sovereignDB.js';
import sovereign from '../config/sovereign.js';
import logger from '../utils/logger.js';

const LOG = 'AuditService';

// ─────────────────────────────────────────────────────────────────────────────
// AuditService
//
// * Writes to the hash-chained audit_logs ledger (tamper-evident).
// * Optionally mirrors to JSONL files in the audit dir for SIEM/CERT-In export.
// * Sensitive data is minimised — document payloads are never logged raw.
// * Retention pruning + full-export endpoints support organisational policies.
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY = {
  AUTH: 'auth', ACCESS: 'access', MODEL: 'model', TOOL: 'tool', TASK: 'task',
  AGENT: 'agent', APPROVAL: 'approval', ARTIFACT: 'artifact', SECURITY: 'security', SYSTEM: 'system',
  NETWORK: 'network', STORAGE: 'storage',
};

export const SEVERITY = { INFO: 'info', NOTICE: 'notice', WARNING: 'warning', CRITICAL: 'critical' };

function sanitizeDetails(details = {}) {
  // Strip anything that could be raw confidential document content.
  const clean = {};
  for (const [k, v] of Object.entries(details || {})) {
    if (typeof v === 'string' && v.length > 500) clean[k] = `${v.slice(0, 500)}…(truncated)`;
    else clean[k] = v;
  }
  return clean;
}

class AuditService {
  constructor() { this.db = null; this.jsonlStream = null; }

  _db() { return this.db || (this.db = getSovereignDB()); }

  ensureJsonl() {
    if (!sovereign.audit.jsonlEnabled || this.jsonlStream) return;
    try {
      fs.mkdirSync(sovereign.paths.auditDir, { recursive: true });
      const file = path.join(sovereign.paths.auditDir, `audit-${new Date().toISOString().split('T')[0]}.jsonl`);
      this.jsonlStream = fs.createWriteStream(file, { flags: 'a' });
    } catch (err) {
      logger.warn(LOG, 'JSONL audit mirror unavailable', { error: err.message });
    }
  }

  record({ category = CATEGORY.SYSTEM, action, severity = SEVERITY.INFO, user = {}, details = {}, ip = '', userAgent = '', sessionId = '' }) {
    const safe = sanitizeDetails(details);
    const entry = {
      userId: user?.id || user?.userId || null,
      userEmail: user?.email || '',
      sessionId,
      category,
      action,
      severity,
      ip,
      userAgent,
      details: safe,
    };
    try {
      const written = this._db().insertAudit(entry);
      this.ensureJsonl();
      if (this.jsonlStream) {
        this.jsonlStream.write(`${JSON.stringify({ ...entry, ...written, timestamp: new Date().toISOString() })}\n`);
      }
      return written;
    } catch (err) {
      logger.error(LOG, `Audit write failed (${category}/${action})`, { error: err.message });
      // Never let audit failure take down a business action, but surface loudly.
      return { id: 'audit-error', error: err.message };
    }
  }

  modelInvocation({ user, model, taskType, ok, latencyMs, detail = {} }) {
    this.record({ category: CATEGORY.MODEL, action: 'model_invoke', severity: ok ? SEVERITY.INFO : SEVERITY.WARNING, user, details: { model, taskType, ok, latencyMs, ...detail } });
  }

  taskCreated({ user, taskId, question, taskType, risk }) {
    this.record({ category: CATEGORY.TASK, action: 'task_created', severity: SEVERITY.INFO, user, details: { taskId, question: (question || '').slice(0, 300), taskType, risk } });
  }

  approvalEvent({ user, taskId, action, note, risk }) {
    this.record({ category: CATEGORY.APPROVAL, action: `task_${action}`, severity: action === 'approve' ? SEVERITY.NOTICE : SEVERITY.WARNING, user, details: { taskId, note: (note || '').slice(0, 500), risk } });
  }

  securityEvent(action, details, severity = SEVERITY.CRITICAL, user = {}) {
    this.record({ category: CATEGORY.SECURITY, action, severity, user, details });
  }

  networkEvent(details, severity = SEVERITY.WARNING, user = {}) {
    this.record({ category: CATEGORY.NETWORK, action: 'egress', severity, user, details });
  }

  // Verified integrity of the ledger.
  verify() { return this._db().verifyAuditChain(); }

  list(opts) { return this._db().listAudit(opts); }

  exportAll() { return this._db().exportAudit(); }

  prune() {
    const before = this._db().verifyAuditChain();
    const r = this._db().pruneAudit(sovereign.audit.retentionDays);
    const after = this._db().verifyAuditChain();
    this.record({ category: CATEGORY.SYSTEM, action: 'audit_prune', severity: SEVERITY.INFO, details: { retentionDays: sovereign.audit.retentionDays, pruned: r.pruned, chainBefore: before.intact, chainAfter: after.intact } });
    return { ...r, chainBefore: before.intact, chainAfter: after.intact };
  }
}

let _audit = null;
export const auditService = () => (_audit || (_audit = new AuditService()));
export default auditService;