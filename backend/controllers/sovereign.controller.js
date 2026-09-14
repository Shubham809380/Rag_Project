import fs from 'fs';
import path from 'path';
import os from 'os';
import multer from 'multer';
import sovereign from '../config/sovereign.js';
import { analyzeImage as runVisionAnalysis } from '../vision/visionService.js';
import { runPythonWithTests } from '../sandbox/docker.js';
import { getSovereignDB } from '../storage/sovereignDB.js';
import { modelRouter } from '../models/router.js';
import { modelRegistry } from '../models/registry.js';
import { orchestrator } from '../agents/orchestrator.js';
import { toolRegistry } from '../tools/registry.js';
import { monitor } from '../monitor/monitor.js';
import { auditService } from '../security/audit.js';
import { policy } from '../security/policy.js';
import { canApprove, normalizeUser, canReach, PERM } from '../security/rbac.js';
import { ingestSovereignDocument } from '../rag/sovereignPipeline.js';
import { validateFileSignature } from '../services/document.service.js';
import { probeProviders } from '../ocr/ocrService.js';
import { isDockerAvailable } from '../sandbox/docker.js';
import { resolveModelId } from '../models/registry.js';
import { resolveSovereignUser, sovereignRoleAtLeast } from '../security/sovereignAuth.js';
import { DEMO_TESTS, runDemoTest } from '../services/demoTests.js';
import { getLocalProvider } from '../providers/index.js';
import logger from '../utils/logger.js';

const CODE_GEN_SYSTEM = 'You are a precise Python code generator. Output ONLY executable Python 3 code: no markdown, no code fences, no explanations. Match the user\'s request exactly — implement exactly the function(s), name(s), arguments and outputs they asked for. This sandbox has NO keyboard and NO standard input, so NEVER call input() or open a terminal session — even for topics that are normally interactive (calculator, quiz, game, login). Instead use fixed sample values and print the results. Never import os, sys, subprocess, socket, urllib, urllib.request, requests or any network library. The code must run standalone and print its answer clearly.';

function cleanGeneratedCode(raw) {
  const lines = String(raw || '').split('\n');
  while (lines.length && /^\s*(```|~~~)/.test(lines[0])) lines.shift();
  while (lines.length && /^\s*(```|~~~)\s*$/.test(lines[lines.length - 1])) lines.pop();
  return lines.join('\n').replace(/^Here is[^:]*:\s*\n/i, '').trim();
}

// Deterministic guard against interactive code in the NON-interactive sandbox:
// replaces input()/raw_input() reads with fixed sample values so a runnable
// program produced for any prompt never dies with EOFError (no stdin exists).
function neutralizeInput(code) {
  let fi = 0, ii = 0;
  const fs = ['12.0', '7.5', '3.25', '19.0', '5.0'];
  const is = ['7', '12', '5', '9', '3'];
  const arg = String.raw`(?:'[^']*'|"[^"]*"|[^()])*`;
  return String(code || '')
    .replace(new RegExp(`float\\s*\\(\\s*input\\(${arg}\\s*\\)\\s*\\)`, 'g'), () => fs[fi++ % fs.length])
    .replace(new RegExp(`int\\s*\\(\\s*input\\(${arg}\\s*\\)\\s*\\)`, 'g'), () => is[ii++ % is.length])
    .replace(new RegExp(`eval\\s*\\(\\s*input\\(${arg}\\s*\\)\\s*\\)`, 'g'), () => is[ii++ % is.length])
    .replace(new RegExp(`str\\s*\\(\\s*input\\(${arg}\\s*\\)\\s*\\)`, 'g'), () => "'sample'")
    .replace(new RegExp(`raw_input\\(${arg}\\s*\\)`, 'g'), () => "'sample'")
    .replace(new RegExp(`\\binput\\(${arg}\\s*\\)`, 'g'), () => "'sample'");
}

const LOG = 'SovereignCtrl';
const uploadMulter = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Resolve the acting user: sovereign JWT (production) or scoped demo identity
// (non-production, DEMO_MODE only). Production NEVER trusts x-sovereign-* headers.
function sovereignUser(req) {
  const resolved = resolveSovereignUser(req);
  if (resolved) return resolved;
  return normalizeUser(null);
}

function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Privileged roles (admin/manager/engineer/reviewer) may see supervisory data
// (all tasks/artifacts/audit logs); analyst/inspector see only what they own.
function isPrivileged(user) {
  return canReach(user, PERM.PRIVILEGED);
}

// Model accounting for honest reporting: installed ≠ routed. Multiple routing
// slots may point at the same installed model (here reasoning + coding both
// route to llama3.2); models installed but unused are explicitly labelled.
async function captureModelSummary(activeProfileModels) {
  const provider = getLocalProvider();
  const inst = (await provider.listModels().catch(() => [])) || [];
  const norm = (id) => String(id || '').replace(/:latest$/i, '').trim();
  const installed = inst.map((m) => ({ id: norm(m.id ?? m.name), size: m.size || 0 }));
  const routed = {};
  for (const s of activeProfileModels) {
    if (s.status === 'available') (routed[s.modelId] = routed[s.modelId] || []).push(s.role);
  }
  return {
    installedCount: installed.length,
    installed,
    routedModels: Object.fromEntries(Object.entries(routed).map(([id, roles]) => [id, { roles }])),
    installedNotRouted: installed.filter((m) => !routed[m.id]).map((m) => m.id),
    note: 'Multiple routing slots may reuse one installed model (reasoning + coding both route to llama3.2). Installed models not used by any slot are "Installed / Available but not currently routed".',
  };
}

function taskVisible(task, user) {
  return !!task && (user.isAdmin || isPrivileged(user) || task.userId === normalizeUser(user).id);
}

function artifactVisible(artifact, db, user) {
  if (!artifact) return false;
  if (user.isAdmin || isPrivileged(user)) return true;
  if (artifact.userId === normalizeUser(user).id) return true;
  if (artifact.taskId) {
    const task = db.getTask(artifact.taskId);
    if (task && task.userId === normalizeUser(user).id) return true;
  }
  return false;
}

export async function sovereignStatusHandler(req, res) {
  const db = getSovereignDB();
  const mon = monitor();
  if (!mon.patched) mon.init();
  if (sovereign.network.probeEnabled && mon.getStatus().internetConnectivity === null) {
    await mon.probeInternet(); // real TCP probe, bypasses the egress guard
  }
  const st = mon.getStatus();
  const allModels = db.listModels();
  const models = allModels
    .filter((m) => m.profile === sovereign.hardwareProfile)
    .map((m) => ({ key: m.modelKey, name: m.name, modelId: resolveModelId(m.modelKey), status: m.status, profile: m.profile, role: m.role }));
  const modelSummary = await captureModelSummary(models);
  res.json({
    mode: sovereign.mode,
    egress: st.egressMode,
    internetConnected: st.internetConnectivity,
    probes: st.probes,
    localServices: st.localServices,
    hardwareProfile: sovereign.hardwareProfile,
    storage: { backend: sovereign.storage.backend, sqlite: sovereign.storage.sqlitePath },
    embeddings: { fallbackAllowed: sovereign.embeddings.allowFallback, dimension: sovereign.embeddings.fallbackDim, preferredModel: resolveModelId('embedding_embed') },
    telemetry: sovereignTelemetry(db, mon),
    counts: db.stats(),
    models,
    modelSummary,
    agent: sovereign.agent,
    approvals: sovereign.approvals,
    sandbox: {
      dockerConfigured: sovereign.sandbox,
      dockerAvailable: await isDockerAvailable(),
      hostFallback: sovereign.sandbox.hostFallback === true,
      available: sovereign.sandbox.hostFallback === true || await isDockerAvailable(),
    },
  });
}

export async function sovereignAvailabilityHandler(req, res) {
  const [ocr, docker] = await Promise.all([probeProviders(), isDockerAvailable()]);
  const db = getSovereignDB();
  const models = db.listModels();
  res.json({
    ocr: { tesseract: ocr.tesseract, paddle: ocr.paddleOCR, pdfRendering: ocr.pdfRendering, visionAsOCR: ocr.visionModel },
    sandbox: { dockerAvailable: docker, hostFallback: sovereign.sandbox.hostFallback === true, available: sovereign.sandbox.hostFallback === true || docker },
    models: models.map(m => ({ modelId: resolveModelId(m.modelKey), status: m.status, role: m.role })),
    egress: monitor().getStatus().egressMode,
  });
}

export default function sovereignController(router) {
  // ── system status / dashboard ──────────────────────────────────────────
  router.get('/sovereign/dashboard', asyncH(async (req, res) => {
    const db = getSovereignDB();
    const user = normalizeUser(sovereignUser(req));
    const scoped = user.isAdmin || isPrivileged(user);
    const mon = monitor();
    if (!mon.patched) mon.init();
    if (sovereign.network.probeEnabled && mon.getStatus().internetConnectivity === null) {
      await mon.probeInternet();
    }
    const tasks = scoped ? db.listTasks({}) : db.listTasks({ userId: user.id });
    const approvals = tasks.filter(t => t.status === 'waiting_approval');
    const artifacts = scoped ? db.listArtifacts({}) : db.listArtifacts({}).filter(a => artifactVisible(a, db, user));
    res.json({
      collections: db.listCollections(),
      documents: db.listAccessibleDocuments(user),
      tasks,
      pendingApprovals: approvals,
      artifacts,
      auditEntries: scoped ? db.listAudit({ limit: 50 }) : [],
      chainVerified: db.verifyAuditChain(),
      stats: db.stats(),
      telemetry: sovereignTelemetry(db, mon),
      egressEvents: mon.getStatus().recentEvents.slice(0, 25),
    });
  }));

  router.get('/sovereign/models', asyncH(async (_req, res) => {
    await modelRegistry.syncFromProvider();
    const all = getSovereignDB().listModels();
    const models = all
      .filter((m) => m.profile === sovereign.hardwareProfile)
      .map((m) => ({ ...m, modelId: resolveModelId(m.modelKey) }));
    const summary = await captureModelSummary(models);
    res.json({
      models,
      router: modelRouter().getStatus(),
      installed: summary.installed,
      installedCount: summary.installedCount,
      installedNotRouted: summary.installedNotRouted,
      routedModels: summary.routedModels,
      note: summary.note,
    });
  }));

  // ── collections ────────────────────────────────────────────────────────
  router.get('/sovereign/collections', asyncH(async (req, res) => {
    res.json({ collections: getSovereignDB().listCollections() });
  }));

  router.post('/sovereign/collections', asyncH(async (req, res) => {
    const { name, description = '', department = '' } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'name required' });
    const c = getSovereignDB().createCollection({ name, description, department, ownerUserId: sovereignUser(req).id });
    auditService().record({ category: 'system', action: 'collection_created', user: sovereignUser(req), details: { collectionId: c.id, name } });
    res.status(201).json({ collection: c });
  }));

  // ── documents ──────────────────────────────────────────────────────────
  router.get('/sovereign/documents', asyncH(async (req, res) => {
    const db = getSovereignDB();
    const u = normalizeUser(sovereignUser(req));
    const docs = db.listAccessibleDocuments(u);
    const view = docs.map(d => ({
      id: d.id, filename: d.filename, fileType: d.fileType, status: d.status, pages: d.pages,
      classification: d.classification, department: d.department, collectionId: d.collectionId,
      size: d.fileSize, createdAt: d.createdAt, access: 'granted',
    }));
    res.json({ documents: view, scope: u.isAdmin ? 'admin' : (isPrivileged(u) ? 'privileged' : 'owned'), total: view.length });
  }));

  router.get('/sovereign/documents/:id', asyncH(async (req, res) => {
    const db = getSovereignDB();
    const u = normalizeUser(sovereignUser(req));
    const doc = db.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'not found' });
    if (!u.isAdmin && !db.canAccessDocument(doc.id, u)) {
      return res.status(403).json({ success: false, code: 'SOVEREIGN_FORBIDDEN', message: 'You do not have access to this document' });
    }
    const chunks = db.getChunksForDocument(doc.id).map(c => ({ index: c.chunkIndex, page: c.page, section: c.section, text: c.text }));
    res.json({ document: doc, chunks, grants: db.getDocumentGrants(doc.id) });
  }));

  router.post('/sovereign/documents', uploadMulter.single('file'), asyncH(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'file required (field "file")' });
    const { collectionId = null } = req.body || {};
    const classification = String((req.body && req.body.classification) || req.query.classification || 'INTERNAL').trim();
    const department = String((req.body && req.body.department) || req.query.department || '').trim();
    const u = normalizeUser(sovereignUser(req));
    const tmp = `sovereign/uploads/tmp-${Date.now()}-${sanitize(req.file.originalname)}`;
    fs.mkdirSync('sovereign/uploads', { recursive: true });
    fs.writeFileSync(tmp, req.file.buffer);
    const sig = validateFileSignature(req.file.buffer, req.file.originalname);
    if (!sig.valid) {
      fs.rmSync(tmp, { force: true });
      return res.status(415).json({ success: false, error: sig.error, code: 'SIGNATURE_MISMATCH' });
    }
    const result = await ingestSovereignDocument({ filePath: tmp, filename: req.file.originalname, user: u, collectionId, classification, department });
    if (!result.success) {
      if (!result.documentId) fs.rmSync(tmp, { force: true });
      return res.status(422).json({ success: false, ...result });
    }
    auditService().record({ category: 'system', action: 'document_ingested', user: u, details: { documentId: result.documentId, filename: result.filename, chunks: result.chunks, route: result.route } });
    res.status(201).json({ success: true, ...result });
  }));

  router.get('/sovereign/documents/:id/source', asyncH(async (req, res) => {
    const db = getSovereignDB();
    const u = normalizeUser(sovereignUser(req));
    const doc = db.getDocument(req.params.id);
    if (!doc || !doc.filePath || !fs.existsSync(doc.filePath)) return res.status(404).json({ success: false, error: 'source not stored' });
    if (!u.isAdmin && !db.canAccessDocument(doc.id, u)) {
      return res.status(403).json({ success: false, code: 'SOVEREIGN_FORBIDDEN', message: 'You do not have access to this document' });
    }
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.filename)}"`);
    res.sendFile(doc.filePath);
  }));

  // ── agent tasks ────────────────────────────────────────────────────────
  router.post('/sovereign/tasks/start', asyncH(async (req, res) => {
    const { question, documentIds } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ success: false, error: 'question required' });
    const u = sovereignUser(req);
    const ids = Array.isArray(documentIds) ? documentIds.map(String).filter(Boolean).slice(0, 20) : [];
    const result = await orchestrator().start({ user: u, sessionId: req.headers['x-session-id'] || null, input: question.trim(), documentIds: ids });
    res.json(result);
  }));

  router.get('/sovereign/tasks', asyncH(async (req, res) => {
    const db = getSovereignDB();
    const u = normalizeUser(sovereignUser(req));
    const all = db.listTasks({});
    const tasks = all.filter(t => taskVisible(t, u));
    res.json({ tasks, scope: u.isAdmin ? 'admin' : (isPrivileged(u) ? 'privileged' : 'owned') });
  }));

  router.get('/sovereign/tasks/:id', asyncH(async (req, res) => {
    const db = getSovereignDB();
    const u = normalizeUser(sovereignUser(req));
    const task = db.getTask(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'not found' });
    if (!taskVisible(task, u)) {
      return res.status(403).json({ success: false, code: 'SOVEREIGN_FORBIDDEN', message: 'You do not have access to this task' });
    }
    res.json({ task, approvals: db.getApprovals(task.id), artifacts: (task.artifacts || []).map(a => ({ ...a, downloadPath: `/api/sovereign/artifacts/${a.id}/download` })) });
  }));

  router.post('/sovereign/tasks/:id/approve', asyncH(async (req, res) => {
    const { decision = 'approved', note = '' } = req.body || {};
    const approver = sovereignUser(req);
    if (!canApprove(approver)) return res.status(403).json({ success: false, error: 'Your role cannot approve tasks' });
    const result = await orchestrator().proceedAfterApproval({ taskId: req.params.id, approver, note, decision });
    if (!result.ok) {
      const task = getSovereignDB().getTask(req.params.id);
      return res.status(result.statusCode || 400).json({
        success: false,
        ok: false,
        taskId: req.params.id,
        taskStatus: task?.status || 'unknown',
        approvalStatus: task?.approval_status || null,
        reason: result.reason,
      });
    }
    const task = getSovereignDB().getTask(req.params.id);
    res.json({
      ok: true,
      success: true,
      decision,
      taskId: result.taskId || req.params.id,
      taskStatus: task?.status || result.status,
      approvalStatus: task?.approval_status || 'approved',
      riskLevel: task?.approval_risk || result.approvalRisk || null,
      generated: !!result.generated,
      model: result.model || task?.model || null,
      artifact: result.artifact || null,
      packet: result.packet || null,
      timestamp: new Date().toISOString(),
    });
  }));

  // ── artifacts ──────────────────────────────────────────────────────────
  router.get('/sovereign/artifacts', asyncH(async (req, res) => {
    const db = getSovereignDB();
    const u = normalizeUser(sovereignUser(req));
    const artifacts = db.listArtifacts({}).filter(a => artifactVisible(a, db, u));
    res.json({ artifacts, scope: u.isAdmin ? 'admin' : (isPrivileged(u) ? 'privileged' : 'owned') });
  }));

  router.get('/sovereign/artifacts/:id/download', asyncH(async (req, res) => {
    const db = getSovereignDB();
    const u = normalizeUser(sovereignUser(req));
    const a = db.getArtifact(req.params.id);
    if (!a || !fs.existsSync(a.path)) return res.status(404).json({ success: false, error: 'artifact not found' });
    if (!artifactVisible(a, db, u)) {
      return res.status(403).json({ success: false, code: 'SOVEREIGN_FORBIDDEN', message: 'You do not have access to this artifact' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(a.name)}"`);
    res.setHeader('Content-Type', a.mime || 'application/octet-stream');
    res.sendFile(a.path);
  }));

  // ── tools (nominal metadata for the UI) ────────────────────────────────
  router.get('/sovereign/tools', asyncH(async (req, res) => {
    res.json({ tools: toolRegistry().all() });
  }));

  // ── audit ──────────────────────────────────────────────────────────────
  router.get('/sovereign/audit', sovereignRoleAtLeast(PERM.PRIVILEGED), asyncH(async (req, res) => {
    const db = getSovereignDB();
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 2000);
    const entries = db.listAudit({ limit, category: req.query.category || null, severity: req.query.severity || null });
    res.json({ entries, chainVerified: db.verifyAuditChain() });
  }));

  // ── demo control panel: real capability tests (SIH judge demo) ────────────
  router.get('/sovereign/tests', sovereignRoleAtLeast(PERM.PRIVILEGED), asyncH(async (req, res) => {
    res.json({ ok: true, available: Object.keys(DEMO_TESTS), note: 'POST /sovereign/tests/:name runs a real check' });
  }));

  router.post('/sovereign/tests/:name', sovereignRoleAtLeast(PERM.PRIVILEGED), asyncH(async (req, res) => {
    const u = normalizeUser(sovereignUser(req));
    const name = String(req.params.name || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!Object.hasOwn(DEMO_TESTS, name)) return res.status(400).json({ ok: false, error: `Unknown test "${name}"` });
    const result = await runDemoTest(name, u);
    res.json({ ok: true, result });
  }));

  // ── vision analysis (ad-hoc, non-document) ─────────────────────────────
  router.post('/sovereign/vision/analyze', uploadMulter.single('file'), asyncH(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'file field required' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const imageTypes = ['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp'];
    if (!imageTypes.includes(ext)) return res.status(400).json({ success: false, error: 'Unsupported image type' });
    const tmpDir = path.join(process.cwd(), 'sovereign', 'uploads');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `vision-${Date.now()}-${sanitize(req.file.originalname)}`);
    fs.writeFileSync(tmpPath, req.file.buffer);
    const visSig = validateFileSignature(req.file.buffer, req.file.originalname);
    if (!visSig.valid) {
      fs.rmSync(tmpPath, { force: true });
      return res.status(415).json({ success: false, error: visSig.error, code: 'SIGNATURE_MISMATCH' });
    }
    try {
      const result = await runVisionAnalysis({
        filePath: tmpPath,
        fileType: req.file.mimetype,
        prompt: req.body.prompt || 'Describe everything observable in this image. Focus on industrial equipment condition, defects, anomalies, gauges and labels.',
      });
      auditService().record({
        category: 'tool', action: 'tool_start', user: sovereignUser(req),
        details: { tool: 'analyzeImage', file: req.file.originalname, ok: result.ok, model: result.model || null },
      });
      res.json({ success: result.ok, ...result });
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
  }));

  // ── system host metrics (monitoring page) ──────────────────────────────
  router.get('/sovereign/system', sovereignRoleAtLeast(PERM.PRIVILEGED), asyncH(async (req, res) => {
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    let disk = null;
    try {
      const st = fs.statfsSync(process.cwd());
      disk = { total: st.blocks * st.bsize, free: st.bavail * st.bsize };
    } catch { /* statfs unavailable */ }
    const db = getSovereignDB();
    res.json({
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      cpu: { model: (os.cpus()[0] || {}).model || null, cores: os.cpus().length, loadAvg: os.loadavg() },
      memory: { total: totalmem, free: freemem, used: totalmem - freemem, pct: Math.round(((totalmem - freemem) / totalmem) * 100) },
      disk,
      uptimeSec: Math.round(os.uptime()),
      node: process.version,
      pid: process.pid,
      counts: db.stats(),
    });
  }));

  // ── dataset analysis (CSV / XLSX statistical profile, no AI required) ──
  router.post('/sovereign/data/analyze', uploadMulter.single('file'), asyncH(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'file field required' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.csv', '.xlsx', '.xls'].includes(ext)) return res.status(400).json({ success: false, error: 'Unsupported dataset format (CSV or XLSX)' });
    if (ext !== '.csv' && ext !== '.xls') {
      const dsSig = validateFileSignature(req.file.buffer, req.file.originalname);
      if (!dsSig.valid) return res.status(415).json({ success: false, error: dsSig.error, code: 'SIGNATURE_MISMATCH' });
    }
    let XLSX;
    try { ({ default: XLSX } = await import('xlsx')); } catch { return res.status(500).json({ success: false, error: 'xlsx parser unavailable' }); }
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (!rows.length) return res.json({ filename: req.file.originalname, ok: true, rows: 0, cols: 0, columns: [], anomalies: [], sample: [], warning: 'empty sheet' });
    const cols = rows[0].map((c, i) => `${String(c ?? ('Column' + (i + 1))).trim()}`);
    const body = rows.slice(1).filter(r => r.some(v => v !== null && v !== ''));
    const numericIdx = cols.map((_, i) => i).filter(i => body.some(r => typeof r[i] === 'number'));
    const columns = cols.map((name, i) => {
      const values = body.map(r => r[i]).filter(v => v !== null && v !== '');
      const numeric = values.every(v => typeof v === 'number');
      if (!numeric) return { name, type: 'text', values: values.length, nulls: body.length - values.length };
      const nums = values;
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / nums.length;
      const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
      return {
        name, type: 'numeric', values: nums.length, nulls: body.length - nums.length,
        min: Math.min(...nums), max: Math.max(...nums), mean: +mean.toFixed(4),
        std: +Math.sqrt(variance).toFixed(4),
      };
    });
    const anomalies = [];
    numericIdx.forEach(i => {
      const nums = body.map(r => r[i]).filter(v => typeof v === 'number');
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const sd = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length) || 1e-9;
      nums.forEach((v, r) => {
        const z = (v - mean) / sd;
        if (Math.abs(z) > 3) anomalies.push({ column: cols[i], row: r + 2, value: v, zScore: +z.toFixed(2), reason: 'z-score outlier (>3σ)' });
      });
    });
    res.json({
      filename: req.file.originalname, ok: true, workbook: wb.SheetNames[0],
      rows: body.length, cols: cols.length, columns, anomalies: anomalies.slice(0, 50),
      sample: body.slice(0, 20),
    });
  }));

  // ── in-app code execution (isolated sandbox; network disabled) ─────────
  router.post('/sovereign/code/generate', asyncH(async (req, res) => {
    const { prompt, tests } = req.body || {};
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ success: false, error: 'prompt is required' });

    const gen = await modelRouter().generate({
      messages: [
        { role: 'system', content: CODE_GEN_SYSTEM },
        { role: 'user', content: String(prompt) },
      ],
      taskType: 'coding',
    });

    if (!gen.ok || !gen.content) {
      return res.json({ success: false, code: '', run: null, error: gen.message || 'Local model could not generate code' });
    }

    let code = cleanGeneratedCode(gen.content);
    let run = await runPythonWithTests({ code, tests: String(tests || '') });

    const repairNotes = [
      'The previous version used input()/keyboard reads in this non-interactive sandbox and raised EOFError (no stdin). Regenerate the SAME program using FIXED sample values, print every result, and do not call input() anywhere.',
      'STILL WRONG — input() keeps appearing and raises EOFError. Output a program with NO input(), NO menu, NO choice prompt, NO interactive loop. Hard-code example inputs such as num1 = 12, num2 = 7 and print the answers with clear labels. Complete standalone code only.',
    ];
    for (const note of repairNotes) {
      if (run.ok || !/EOFError|input\s*\(|raw_input/.test(run.stderr || '')) break;
      const again = await modelRouter().generate({
        messages: [
          { role: 'system', content: CODE_GEN_SYSTEM },
          { role: 'user', content: String(prompt) },
          { role: 'user', content: note },
        ],
        taskType: 'coding',
      });
      if (again.ok && again.content) {
        code = cleanGeneratedCode(again.content);
        run = await runPythonWithTests({ code, tests: String(tests || '') });
      }
    }

    let repair = null;
    if (!run.ok && /EOFError|input\s*\(|raw_input/.test(run.stderr || '')) {
      code = neutralizeInput(code);
      run = await runPythonWithTests({ code, tests: String(tests || '') });
      repair = 'input-neutered';
    }

    auditService().record({
      category: 'tool', action: 'tool_start', user: sovereignUser(req),
      details: { tool: 'generateCode', ok: run.ok, model: gen.model, prompt: String(prompt).slice(0, 200) },
    });

    res.json({ success: true, code, run, model: gen.model, repair });
  }));

  router.post('/sovereign/code/execute', asyncH(async (req, res) => {
    const { code, tests, question } = req.body || {};
    if (!code || !String(code).trim()) return res.status(400).json({ success: false, error: 'code is required' });
    const result = await runPythonWithTests({ code: String(code), tests: String(tests || ''), question: String(question || '') });
    auditService().record({
      category: 'tool', action: 'tool_start', user: sovereignUser(req),
      details: { tool: 'executePython', ok: result.ok, stdout: (result.stdout || '').slice(0, 400) },
    });
    res.json(result);
  }));

  // ── global search across sovereign domain ──────────────────────────────
  router.get('/sovereign/search', asyncH(async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const db = getSovereignDB();
    const u = normalizeUser(sovereignUser(req));
    const scoped = u.isAdmin || isPrivileged(u);
    if (!q) return res.json({ documents: [], tasks: [], artifacts: [], audit: [] });
    const match = (...fields) => (item) => fields.some(f => item[f] && String(item[f]).toLowerCase().includes(q));
    const docs = scoped ? db.listDocuments({}) : db.listAccessibleDocuments(u);
    const tasks = (scoped ? db.listTasks({}) : db.listTasks({ userId: u.id })).filter(t => taskVisible(t, u));
    const artifacts = (scoped ? db.listArtifacts({}) : db.listArtifacts({})).filter(a => artifactVisible(a, db, u));
    const audit = scoped ? db.listAudit({ limit: 500 }) : [];
    res.json({
      documents: docs.filter(match('name', 'filename', 'classification', 'status')).slice(0, 12).map(d => ({ id: d.id, name: d.name || d.filename, classification: d.classification, status: d.status })),
      tasks: tasks.filter(match('title', 'question', 'taskType')).slice(0, 12).map(t => ({ id: t.id, title: t.title, status: t.status, taskType: t.taskType })),
      artifacts: artifacts.filter(match('name')).slice(0, 12).map(a => ({ id: a.id, name: a.name, type: a.type })),
      audit: audit.filter(match('action', 'userEmail', 'category')).slice(0, 12).map(e => ({ id: e.id, action: e.action, category: e.category, severity: e.severity })),
    });
  }));

  return router;
}

function sanitize(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

// Real, observable telemetry for the sovereignty dashboard. Nothing here is
// fabricated: egress/model counters come from the monitor's process boundary;
// RAG + tool counts are re-derived from the audit log. Cloud OCR/embedding are
// structurally zero because no cloud provider is ever instantiated in this
// domain — any attempt would still surface in blockedEgress/externalApiCalls.
function sovereignTelemetry(db, mon) {
  const st = mon.getStatus();
  return {
    ...st.counters,
    probes: st.counters.probes,
    probesDisabled: st.internetDisabled === true,
    internetConnected: st.internetConnectivity,
    localRagQueries: db.countAudit({ category: 'tool', action: 'tool_start', detailsLike: 'search_knowledge_base' }),
    localToolExecutions: db.countAudit({ category: 'tool', action: 'tool_start' }),
    cloudOcrCalls: 0,
    cloudEmbeddingCalls: 0,
  };
}