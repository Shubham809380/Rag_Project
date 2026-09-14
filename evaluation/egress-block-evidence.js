import { monitor } from '../backend/monitor/monitor.js';
import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import { auditService, CATEGORY } from '../backend/security/audit.js';

// Egress-evidence script (mission Phases 13/14): demonstrates the workbench
// blocks outbound requests in air-gap mode and records the attempt without leaking.

const LOG = '[egress-evidence]';
const mon = monitor(); if (!mon.patched) mon.init();
const db = getSovereignDB(); db.init();
const status = mon.getStatus();
console.log(`\n[${LOG}] egress mode: ${status.egressMode}`);

// Attempt a real outbound GET (should be blocked or monitored, never leak secrets).
const before = (mon.getStatus().recentEvents || []).filter(e => e.type === 'egress_block').length;
try {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 500);
  await fetch('http://8.8.8.8:53', { signal: controller.signal });
  console.log(`[${LOG}] outbound request succeeded (egress MONITOR/OPEN)`);
} catch (e) {
  console.log(`[${LOG}] outbound attempt intercepted: ${e.message || e.cause?.message || 'blocked'}`);
}
const after = (mon.getStatus().recentEvents || []).filter(e => e.type === 'egress_block').length;
console.log(`[${LOG}] egress_block events before=${before} after=${after} delta=${after - before}`);

// Audit trail: record a checkpoint for the final report.
auditService().record({ category: CATEGORY.SYSTEM, action: 'egress_evidence_complete', severity: 'info', details: { egressMode: status.egressMode, egressBlockCount: after } });
const chain = db.verifyAuditChain();
console.log(`[${LOG}] audit intact=${chain.intact} count=${chain.count}`);
export default { egressMode: status.egressMode, egressBlocks: after, intact: chain.intact };