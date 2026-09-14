import fs from 'fs';
import path from 'path';
import sovereign from '../config/sovereign.js';
import { getSovereignDB } from '../storage/sovereignDB.js';
import auditService from '../security/audit.js';
import logger from '../utils/logger.js';

const LOG = 'Maintenance';

// Daily supervision loop:
//   1. WAL-safe SQLite backup via VACUUM INTO (atomic, consistent snapshot).
//   2. Backup retention (keep N newest).
//   3. Audit-log soft-prune per configured retention, with chain checkpoints.
//   4. Legal-critical records are NEVER pruned: they are identical in structure
//      to every other row, but 'approval'/'artifact'/'security' rows older than
//      retention remain physically present; only 'pruned=1' flags age them out.
//      The tamper-evident hash chain is verified before AND after every prune.
export function runBackup() {
  const db = getSovereignDB();
  const stmp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(sovereign.backup.dir, `sovereign-${stmp}.sqlite`);
  const before = db.integrityCheck();
  if (before !== 'ok') {
    auditService().record({ category: 'system', action: 'backup_failed', severity: 'critical', details: { reason: 'live database failed integrity check (before backup)', path: dest } });
    return { ok: false, error: 'integrity_check_failed_before_backup' };
  }
  db.checkpoint();
  try {
    const info = db.backup(dest);
    // Enforce backup retention: keep newest N.
    let removed = [];
    if (sovereign.backup.retention > 0) {
      const files = fs.readdirSync(sovereign.backup.dir)
        .filter(f => /^sovereign-.*\.sqlite$/.test(f))
        .map(f => ({ f, t: fs.statSync(path.join(sovereign.backup.dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      for (const f of files.slice(sovereign.backup.retention)) {
        fs.rmSync(path.join(sovereign.backup.dir, f.f), { force: true });
        removed.push(f.f);
      }
    }
    auditService().record({ category: 'storage', action: 'backup_created', severity: 'info', details: { path: dest, size: info.size, integrity: info.integrity, removed } });
    return { ok: true, path: dest, size: info.size, integrity: info.integrity, removed };
  } catch (e) {
    auditService().record({ category: 'system', action: 'backup_failed', severity: 'critical', details: { error: String(e && e.message || e), path: dest } });
    return { ok: false, error: String(e && e.message || e) };
  }
}

export function runRetention() {
  const db = getSovereignDB();
  const chainBefore = db.verifyAuditChain();
  if (!chainBefore.intact) {
    auditService().record({ category: 'security', action: 'retention_aborted_chain_break', severity: 'critical', details: { failures: chainBefore.failures.slice(0, 5) } });
    return { ok: false, error: 'audit_chain_break_checkpoint_failed' };
  }
  const expired = db.countExpiredAudit(sovereign.audit.retentionDays);
  if (expired > 0) {
    const result = db.pruneAudit(sovereign.audit.retentionDays);
    const chainAfter = db.verifyAuditChain();
    if (!chainAfter.intact) {
      auditService().record({ category: 'security', action: 'retention_chain_break_after_prune', severity: 'critical', details: { failures: chainAfter.failures.slice(0, 5) } });
      return { ok: false, error: 'audit_chain_break_after_prune' };
    }
    auditService().record({ category: 'system', action: 'audit_retention_pruned', severity: 'info', details: { retentionDays: sovereign.audit.retentionDays, pruned: result.pruned } });
    return { ok: true, pruned: result.pruned, chainIntact: chainAfter.intact };
  }
  return { ok: true, pruned: 0, chainIntact: chainBefore.intact };
}

// Run one supervised maintenance cycle (idempotent, race-guarded).
let _running = false;
export async function runMaintenanceCycle() {
  if (_running) return { ok: false, skipped: 'already_running' };
  _running = true;
  try {
    const backup = sovereign.backup.enabled ? runBackup() : { ok: true, skipped: 'disabled' };
    const retention = runRetention();
    return { backup, retention };
  } finally {
    _running = false;
  }
}

// Boot-time hook: sets up the scheduled maintenance loop. Returns an unref'd
// timer so it never blocks process exit.
export function startMaintenance() {
  if (!sovereign.backup.enabled && sovereign.audit.retentionDays <= 0) {
    return null;
  }
  const cycle = async () => {
    try {
      const r = await runMaintenanceCycle();
      logger.info(LOG, 'maintenance cycle complete', JSON.stringify({ backup: r.backup && r.backup.ok, retention: r.retention && r.retention.ok }));
    } catch (e) {
      logger.error(LOG, 'maintenance cycle failed', String(e && e.message || e));
      try { auditService().record({ category: 'system', action: 'maintenance_cycle_failed', severity: 'warning', details: { error: String(e && e.message || e) } }); } catch {}
    }
  };
  const interval = Math.max(sovereign.backup.enabled ? sovereign.backup.intervalMs : 0, sovereign.backup.maintenanceIntervalMs || sovereign.backup.intervalMs, 60 * 1000);
  const timer = setInterval(cycle, interval);
  timer.unref();
  // First run shortly after boot, not immediately (let startup settle).
  setTimeout(() => { try { cycle(); } catch {} }, 5000).unref();
  return timer;
}