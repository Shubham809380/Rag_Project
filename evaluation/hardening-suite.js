// Hardening verification suite — deterministic, offline, no external dependencies.
// Covers exactly the fixes in the hardening pass: egress classification,
// file-signature validation, audit soft-prune chain integrity, SQLite backup/
// restore, JWT secret fail-fast, task approval-risk validation, and RAG document
// versioning/supersession.
//
// Run:  node evaluation/hardening-suite.js   (exit 0 = all PASS)

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { classifyHost } from '../backend/monitor/monitor.js';
import { validateFileSignature } from '../backend/services/document.service.js';
import { SovereignDB } from '../backend/storage/sovereignDB.js';
import { assertSecureSecrets, default as sovereign } from '../backend/config/sovereign.js';

let failures = 0;
let checks = 0;
function check(name, pass, detail) {
  checks++;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ── 1. Egress host classification (fc/fd prefix bug fix) ────────────────────
const hosts = [
  ['fc-server.example.net', 'external', 'hostname starting with "fc" must never be private'],
  ['fd-pool.corp.internal', 'external', 'hostname starting with "fd" must never be private'],
  ['localhost', 'loopback', 'hostname loopback'],
  ['127.0.0.1', 'loopback', 'IPv4 loopback'],
  ['::1', 'loopback', 'IPv6 loopback'],
  ['10.11.12.13', 'private', 'RFC1918 10/8'],
  ['172.16.0.1', 'private', 'RFC1918 172.16/12'],
  ['172.31.255.1', 'private', 'RFC1918 172.31/12 upper bound'],
  ['172.32.0.1', 'external', 'not RFC1918 (172.32 is public)'],
  ['192.168.1.1', 'private', 'RFC1918 192.168/16'],
  ['8.8.8.8', 'external', 'public resolver'],
  ['fc00::1', 'private', 'IPv6 ULA fc00::/7'],
  ['fd12:3456::1', 'private', 'IPv6 ULA fd00::/7'],
  ['fe80::1', 'private', 'IPv6 link-local fe80::/10'],
  ['2001:4860:4860::8888', 'external', 'IPv6 public'],
  ['::ffff:8.8.8.8', 'external', 'IPv4-mapped public'],
  ['::ffff:192.168.1.1', 'private', 'IPv4-mapped private'],
];
for (const [host, expected, why] of hosts) {
  const got = classifyHost(host);
  check(`classifyHost(${host}) → ${expected}`, got === expected, `${why} (got ${got})`);
}

// ── 2. File signature validation (renamed binary / forged extension) ────────
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const bmp = Buffer.from([0x42, 0x4d, 1, 2, 3, 4]);
const ole2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3, 4]);
check('validateFileSignature(png/.png)', validateFileSignature(png, 'scan.png').valid === true, 'real PNG accepted');
check('validateFileSignature(png/.pdf) → reject', validateFileSignature(png, 'scan.pdf').valid === false, 'PNG bytes with .pdf name rejected');
check('validateFileSignature(garbage/.pdf) → reject', validateFileSignature(Buffer.from('ABCDEFGH'), 'doc.pdf').valid === false, 'renamed binary rejected');
check('validateFileSignature(zip/.docx)', validateFileSignature(zip, 'note.docx').valid === true, 'docx zip container accepted');
check('validateFileSignature(zip/.xlsx)', validateFileSignature(zip, 'sheet.xlsx').valid === true, 'xlsx zip container accepted');
check('validateFileSignature(jpg/.jpg)', validateFileSignature(jpg, 'photo.jpg').valid === true, 'JPEG accepted');
check('validateFileSignature(bmp/.bmp)', validateFileSignature(bmp, 'img.bmp').valid === true, 'BMP accepted');
check('validateFileSignature(zip/.xls) legacy', validateFileSignature(zip, 'old.xls').valid === true, 'zip accepted for legacy xls');
check('validateFileSignature(ole2/.ppt)', validateFileSignature(ole2, 'deck.ppt').valid === true, 'OLE2 accepted for ppt');
check('validateFileSignature(zip/.png) → reject', validateFileSignature(zip, 'shot.png').valid === false, 'zip bytes with .png name rejected');
check('validateFileSignature(txt/.txt) unchecked', validateFileSignature(Buffer.from('plain text content'), 'readme.txt').checked === false, 'no magic defined for txt');

// ── 3. Audit chain + soft prune ─────────────────────────────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sov-hard-'));
const dbPath = path.join(tmpDir, 'audit.sqlite');
{
  const db = new SovereignDB(dbPath).init();
  db.insertAudit({ category: 'auth', action: 'login', userEmail: 'a@b.c', details: { ok: true } });
  db.insertAudit({ category: 'security', action: 'blocked_egress', userEmail: 'a@b.c', details: { host: '8.8.8.8' } });
  db.insertAudit({ category: 'approval', action: 'task_approved', userEmail: 'b@b.c', details: { taskId: 'x' } });
  const before = db.verifyAuditChain();
  check('audit chain intact (3 rows)', before.intact === true && before.count === 3, JSON.stringify(before.failures));

  const pruned = db.pruneAudit(0);
  check('soft prune prunes 3 rows', pruned.pruned === 3, JSON.stringify(pruned));
  const after = db.verifyAuditChain();
  check('chain STILL intact after soft prune', after.intact === true && after.count === 3, 'pruned rows remain physically linked');
  const active = db.listAudit();
  check('listAudit hides pruned rows', active.length === 0, `active=${active.length}`);
  const full = db.exportAudit();
  check('exportAudit still contains pruned legal-critical rows', full.length === 3, `exported=${full.length}`);
  db.close();
}

// ── 4. SQLite backup + restore (WAL-safe VACUUM INTO) ───────────────────────
const backupDbPath = path.join(tmpDir, 'backup.sqlite');
const restoredPath = path.join(tmpDir, 'restored.sqlite');
{
  const db = new SovereignDB(backupDbPath).init();
  const c = db.createCollection({ name: 'hard-1' });
  db.createDocument({ filename: 'report.pdf', collectionId: c.id, checksum: 'aaa', status: 'ready' });
  db.insertAudit({ category: 'system', action: 'seed', details: {} });
  const dest = path.join(tmpDir, 'snapshot.sqlite');
  db.checkpoint();
  const info = db.backup(dest);
  check('backup created with integrity ok', info.ok && info.integrity === 'ok', `size=${info.size} integrity=${info.integrity}`);
  const bak = db.openBackup(dest);
  check('openBackup readable', bak !== null, 'read-only open worked');
  if (bak) {
    const c2 = bak.prepare('SELECT COUNT(*) c FROM documents').get().c;
    check('backup contains the document row', c2 === 1, `count=${c2}`);
    bak.close();
  }
  const rb = db.restoreBackup(dest, { destination: restoredPath });
  check('restoreBackup restores + verifies', rb.ok && rb.integrity === 'ok', JSON.stringify(rb));
  const r2 = new SovereignDB(restoredPath).init();
  const docsAfter = r2.db.prepare('SELECT COUNT(*) c FROM documents').get().c;
  const auditAfter = r2.verifyAuditChain();
  check('restored DB has same documents', docsAfter === 1, `documents=${docsAfter}`);
  check('restored DB chain intact', auditAfter.intact === true, `audit=${auditAfter.count}`);
  r2.close();
  db.close();
}

// ── 5. JWT secret fail-fast ─────────────────────────────────────────────────
{
  const didThrow = (secret, prod) => {
    const prev = sovereign.auth.jwtSecret;
    sovereign.auth.jwtSecret = secret;
    try { assertSecureSecrets({ production: prod }); return false; } catch { return true; } finally { sovereign.auth.jwtSecret = prev; }
  };
  check('production + empty secret → throw', didThrow('', true), 'empty secret must fail fast');
  check('production + known dev secret → throw', didThrow('sovereign-local-dev-secret-change-me', true), 'known placeholder must fail fast');
  check('production + known classic dev secret → throw', didThrow('insightrag-dev-secret-change-in-production', true), 'classic placeholder must fail fast');
  check('production + short secret(<32) → throw', didThrow('short-secret', true), 'weak secret must fail fast');
  check('production + strong secret → allowed', !didThrow(crypto.randomBytes(32).toString('hex'), true), 'strong unique secret accepted');
  check('dev + known dev secret → warn (no throw)', !didThrow('insightrag-dev-secret-change-in-production', false) === true, 'dev placeholder warns only');
}

// ── 6. Approval-risk validation at the DB boundary ──────────────────────────
{
  const db = new SovereignDB(path.join(tmpDir, 'risk.sqlite')).init();
  const ok = db.createTask({ question: 'q', approvalStatus: 'pending', approvalRisk: 'high' });
  check('approvalRisk high persisted', ok && ok.approvalRisk === 'high', `got ${ok?.approvalRisk}`);
  const bad = db.createTask({ question: 'q2', approvalStatus: 'pending', approvalRisk: 'wreck-the-db' });
  check('forged approvalRisk coerced to low', bad && bad.approvalRisk === 'low', `got ${bad?.approvalRisk}`);
  db.close();
}

// ── 7. Document versioning / supersession / checksum dedupe ─────────────────
{
  const db = new SovereignDB(path.join(tmpDir, 'ver.sqlite')).init();
  const c = db.createCollection({ name: 'ver' });
  const d1 = db.createDocument({ filename: 'sop-231.pdf', collectionId: c.id, checksum: 'A'.repeat(64), version: '1', status: 'ready' });
  const d2 = db.createDocument({ filename: 'sop-231.pdf', collectionId: c.id, checksum: 'B'.repeat(64), version: '2', status: 'ready' });
  const same = db.findActiveByChecksum('A'.repeat(64), c.id);
  check('findActiveByChecksum matches v1', same && same.id === d1.id, `found=${same?.id}`);
  db.markSuperseded(d2.id);
  check('v1 superseded by markSuperseded', db.getDocument(d1.id).superseded === true, 'superseded flag on older version');
  check('findActiveByChecksum(v1) → null (superseded)', db.findActiveByChecksum('A'.repeat(64), c.id) === null, 'superseded doc excluded from active lookup');
  check('findLatestByFilename returns v2', db.findLatestByFilename('sop-231.pdf', c.id)?.id === d2.id, 'latest active prefers current version');
  const hist = db.previousActiveVersions('sop-231.pdf', c.id);
  check('version history preserved', hist.length === 2, `history=${hist.length}`);
  db.close();
}

console.log('');
console.log(failures === 0 ? `ALL ${checks} HARDENING CHECKS PASSED` : `${failures}/${checks} HARDENING CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);