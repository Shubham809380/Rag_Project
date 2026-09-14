import sovereign from '../config/sovereign.js';
import { getSovereignDB } from '../storage/sovereignDB.js';
import { normalizeUser, canReach, canApprove, PERM, ROLES } from './rbac.js';
import logger from '../utils/logger.js';

const LOG = 'PolicyEngine';

// ─────────────────────────────────────────────────────────────────────────────
// PolicyEngine — the SINGLE place where authorisation decisions are made.
// Endpoints and agents call these functions; they never scatter ACL logic.
// ─────────────────────────────────────────────────────────────────────────────

export const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

const CLASS_LEVEL = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3 };

// Documents you cannot retrieve must not even be visible/retrievable.
export class PolicyEngine {
  constructor() { this.db = null; }
  _db() { return this.db || (this.db = getSovereignDB()); }

  // ── role/basic ──────────────────────────────────────────────────────────
  normalizeUser(user) { return normalizeUser(user); }

  canUseTool(user, tool) {
    if (!tool) return { allowed: false, reason: 'Unknown tool' };
    const u = this.normalizeUser(user);
    const level = tool.permissionLevel ?? PERM.PUBLIC;
    const allowed = canReach(u, level);
    if (allowed) return { allowed: true };
    return { allowed: false, reason: `Tool "${tool.name}" requires permission level ${level}; user role "${u.role}" insufficient.` };
  }

  canAccessDocument(user, doc) {
    const u = this.normalizeUser(user);
    if (!u.id) return { allowed: false, reason: 'No authenticated identity' };
    if (u.isAdmin) return { allowed: true };
    return { allowed: this._db().canAccessDocument(doc.id, u), reason: '' };
  }

  // Which documents may this user retrieve in RAG? (returns document ids)
  accessibleDocumentIds(user, { collectionId = null } = {}) {
    const u = this.normalizeUser(user);
    return this._db().listAccessibleDocumentIds(u, { collectionId });
  }

  // ── classification / model policy ───────────────────────────────────────
  // The CRITICAL RULE: RESTRICTED (and CONFIDENTIAL) must never be processed by
  // a provider outside the approved local inference environment.
  modelAllowedForClassification(classification, { providerKind = 'local' } = {}) {
    const level = CLASS_LEVEL[classification] ?? CLASS_LEVEL.INTERNAL;
    if (level >= CLASS_LEVEL.CONFIDENTIAL && providerKind !== 'local') {
      return { allowed: false, reason: `${classification} documents may only be processed by the approved LOCAL inference environment.` };
    }
    return { allowed: true };
  }

  canExport(user, doc) {
    const u = this.normalizeUser(user);
    const level = CLASS_LEVEL[doc?.classification] ?? CLASS_LEVEL.INTERNAL;
    if (level >= CLASS_LEVEL.RESTRICTED) {
      return { allowed: false, requiresApproval: true, reason: 'RESTRICTED documents require human approval before export.' };
    }
    return this.canAccessDocument(u, doc);
  }

  // ── agent policy ────────────────────────────────────────────────────────
  isExternalNetworkAllowed() {
    if (!sovereign.isLocal) return { allowed: true, mode: sovereign.network.egressMode, note: 'online domain' };
    return { allowed: sovereign.network.egressMode !== 'deny', mode: sovereign.network.egressMode, note: 'air-gapped domain' };
  }

  // Risk classification drives human-in-the-loop gates.
  riskFor({ taskType = '', tools = [], classification = 'INTERNAL', domain = '', input = '' }) {
    const text = `${taskType} ${domain} ${input || ''} ${tools.map(t => t.name || t).join(' ')}`.toLowerCase();
    const must = sovereign.approvals.mandatory;
    const rec = sovereign.approvals.reviewRecommended;
    const hit = (list) => list.filter(k => {
      const kk = k.replace(/_/g, ' ');
      return text.includes(k) || text.includes(kk);
    });
    const mandatory = hit(must);
    // Approval/procurement issuance workflows are ALWAYS a supervisory decision —
    // the workbench prepares the packet, a human commits to the decision.
    if (taskType === 'approval_note' || taskType === 'procurement_note') {
      return { risk: 'high', reason: 'Approval/procurement issuance requires human sign-off. The workbench drafts; a supervisor decides.', approvalRequired: true };
    }
    if (mandatory.length) return { risk: 'high', reason: `Mandatory human approval (${mandatory.join(', ')}).`, approvalRequired: true };
    if (CLASS_LEVEL[classification] >= CLASS_LEVEL.RESTRICTED) return { risk: 'high', reason: 'RESTRICTED classification — mandatory human approval.', approvalRequired: true };
    const recommended = hit(rec);
    if (recommended.length) return { risk: 'medium', reason: `Review recommended (${recommended.join(', ')}).`, approvalRequired: false, reviewRecommended: true };
    // Code execution and artifact exports default to medium.
    if (tools.some(t => (t.name || t).includes('execute_python') || (t.name || t).includes('create_word'))) {
      return { risk: 'medium', reason: 'Tool triggers review (code execution / artifact creation).', approvalRequired: false, reviewRecommended: true };
    }
    return { risk: 'low', reason: 'Automatic', approvalRequired: false };
  }

  requiresHumanApproval(riskDecision) {
    return !!riskDecision?.approvalRequired;
  }

  canApproveTask(user) {
    const u = this.normalizeUser(user);
    return canApprove(u);
  }

  // ── egress / sovereignty ────────────────────────────────────────────────
  isExternalTarget(host) {
    const h = String(host || '').toLowerCase().split(':')[0];
    if (!h) return false;
    if (h === 'localhost' || h === '::1' || /^127\./.test(h)) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    if (/^fe80|^fc|^fd|^::/.test(h)) return false;
    return true;
  }
}

let _policy = null;
export const policy = () => (_policy || (_policy = new PolicyEngine()));