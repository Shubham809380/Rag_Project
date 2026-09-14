import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sovereign from '../config/sovereign.js';
import logger from '../utils/logger.js';

const LOG = 'SovereignDB';

const uuid = () => crypto.randomUUID();

// ─────────────────────────────────────────────────────────────────────────────
// Sovereign SQLite storage. Encapsulates ALL sovereign-domain tables.
// Async API parity so the backend can later be swapped to Postgres.
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY, value TEXT
);
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  department TEXT DEFAULT '',
  owner_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  collection_id TEXT,
  filename TEXT NOT NULL,
  file_type TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  pages INTEGER DEFAULT 0,
  status TEXT DEFAULT 'indexing',
  classification TEXT DEFAULT 'INTERNAL',
  department TEXT DEFAULT '',
  version TEXT DEFAULT '1',
  source TEXT DEFAULT '',
  checksum TEXT DEFAULT '',
  metadata_json TEXT DEFAULT '{}',
  owner_user_id TEXT,
  superseded INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS document_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  grantee_type TEXT NOT NULL,        -- 'user' | 'role' | 'public'
  grantee_id TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read',   -- 'read' | 'write' | 'admin'
  granted_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  section TEXT DEFAULT '',
  page INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vector_embeddings (
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  dimension INTEGER NOT NULL,
  vector_json TEXT NOT NULL,
  provider TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (document_id, chunk_index)
);
CREATE TABLE IF NOT EXISTS model_registry (
  id TEXT PRIMARY KEY,
  model_key TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,               -- reasoning | coding | vision | embedding | rerank | ocr
  capabilities_json TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local',
  status TEXT NOT NULL DEFAULT 'configured',   -- configured | available | unavailable | disabled
  vram_gb REAL DEFAULT 0,
  profile TEXT DEFAULT 'small',     -- small | mid | large
  benchmark_json TEXT DEFAULT '{}',
  is_builtin INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  title TEXT DEFAULT '',
  question TEXT NOT NULL,
  task_type TEXT DEFAULT '',
  model TEXT DEFAULT '',
  workflow TEXT DEFAULT '',
  status TEXT DEFAULT 'queued',     -- queued|running|awaiting_approval|completed|failed|rejected|cancelled
  plan_json TEXT DEFAULT '[]',
  trace_json TEXT DEFAULT '[]',
  sources_json TEXT DEFAULT '[]',
  artifacts_json TEXT DEFAULT '[]',
  approval_status TEXT DEFAULT 'not_required', -- not_required|auto_approved|approved|rejected|awaiting
  approval_risk TEXT DEFAULT 'low',  -- low|medium|high
  approver_user_id TEXT,
  approval_note TEXT DEFAULT '',
  error TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,            -- approve | reject
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  user_id TEXT,
  name TEXT NOT NULL,
  type TEXT DEFAULT '',           -- docx | xlsx | pdf | pptx | txt | csv | py
  mime TEXT DEFAULT '',
  path TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  meta_json TEXT DEFAULT '{}',
  checksum TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  seq INTEGER UNIQUE,
  timestamp TEXT NOT NULL,
  user_id TEXT,
  user_email TEXT,
  session_id TEXT DEFAULT '',
  category TEXT NOT NULL,         -- auth|access|model|tool|task|approval|artifact|security|system|network|storage
  action TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info', -- info|notice|warning|critical
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  details_json TEXT DEFAULT '{}',
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  pruned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sovereignty_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,       -- egress_block|egress_attempt|probe|local_model|local_db|system
  destination TEXT DEFAULT '',
  provider TEXT DEFAULT '',
  success INTEGER DEFAULT 1,
  detail_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  task_type TEXT DEFAULT '',
  model TEXT DEFAULT '',
  latency_ms INTEGER DEFAULT 0,
  success INTEGER DEFAULT 1,
  detail_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  employee_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'analyst',   -- admin|engineer|manager|analyst|inspector|reviewer
  password_hash TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',  -- active|inactive
  must_change_password INTEGER NOT NULL DEFAULT 0,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  logout_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_collection ON documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_access_doc ON document_access(document_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_artifact_user ON artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_seq ON audit_logs(seq);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_sovereignty_ts ON sovereignty_events(created_at);
`;

function rowToCollection(r) {
  if (!r) return null;
  return { id: r.id, name: r.name, description: r.description, department: r.department, ownerUserId: r.owner_user_id, createdAt: r.created_at, updatedAt: r.updated_at };
}
function rowToDocument(r) {
  if (!r) return null;
  return {
    id: r.id, collectionId: r.collection_id, filename: r.filename, fileType: r.file_type,
    filePath: r.file_path, fileSize: r.file_size, pages: r.pages, status: r.status,
    classification: r.classification, department: r.department, version: r.version,
    source: r.source, checksum: r.checksum,
    metadata: safeJson(r.metadata_json, {}), ownerUserId: r.owner_user_id,
    superseded: !!r.superseded, chunkCount: Number(r.chunk_count || 0),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function safeJson(s, fallback) {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
const now = () => new Date().toISOString();

export class SovereignDB {
  constructor(sqlitePath) {
    this.path = sqlitePath;
    this.db = null;
  }

  init() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);
    // Idempotent column migrations for pre-hardening databases.
    try { this.db.exec('ALTER TABLE documents ADD COLUMN superseded INTEGER DEFAULT 0'); } catch {}
    try { this.db.exec('ALTER TABLE audit_logs ADD COLUMN pruned INTEGER NOT NULL DEFAULT 0'); } catch {}
    this.seedModelRegistry();
    return this;
  }

  close() { try { this.db?.close(); } catch {} }

  // ── Collections ─────────────────────────────────────────────────────────
  listCollections() {
    return this.db.prepare('SELECT * FROM collections ORDER BY name').all().map(rowToCollection);
  }
  getCollection(id) { return rowToCollection(this.db.prepare('SELECT * FROM collections WHERE id=?').get(id)); }
  createCollection({ name, description = '', department = '', ownerUserId = null }) {
    const id = uuid();
    const ts = now();
    this.db.prepare('INSERT INTO collections (id,name,description,department,owner_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, description, department, ownerUserId, ts, ts);
    return this.getCollection(id);
  }
  updateCollection(id, patch) {
    const cur = this.db.prepare('SELECT * FROM collections WHERE id=?').get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    this.db.prepare('UPDATE collections SET name=?, description=?, department=?, updated_at=? WHERE id=?')
      .run(next.name ?? cur.name, next.description ?? cur.description, next.department ?? cur.department, now(), id);
    return this.getCollection(id);
  }
  deleteCollection(id) {
    this.db.prepare('DELETE FROM documents WHERE collection_id=?').run(id);
    this.db.prepare('DELETE FROM collections WHERE id=?').run(id);
    return true;
  }

  // ── Documents + access + chunks + vectors ───────────────────────────────
  createDocument(doc) {
    const id = doc.id || uuid();
    const ts = now();
    this.db.prepare(`INSERT INTO documents (id,collection_id,filename,file_type,file_path,file_size,pages,status,
      classification,department,version,source,checksum,metadata_json,owner_user_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, doc.collectionId || null, doc.filename, doc.fileType || '', doc.filePath || '', doc.fileSize || 0,
        doc.pages || 0, doc.status || 'indexing', doc.classification || 'INTERNAL', doc.department || '',
        doc.version || '1', doc.source || '', doc.checksum || '', JSON.stringify(doc.metadata || {}),
        doc.ownerUserId || null, ts, ts);
    return this.getDocument(id);
  }
  getDocument(id) { return rowToDocument(this.db.prepare('SELECT * FROM documents WHERE id=?').get(id)); }
  updateDocument(id, patch) {
    const cur = this.db.prepare('SELECT * FROM documents WHERE id=?').get(id);
    if (!cur) return null;
    const allowed = ['collection_id', 'filename', 'file_type', 'file_path', 'file_size', 'pages', 'status',
      'classification', 'department', 'version', 'source', 'checksum', 'metadata_json', 'owner_user_id', 'superseded'];
    for (const k of allowed) {
      if (patch[k] !== undefined) this.db.prepare(`UPDATE documents SET ${k}=? WHERE id=?`).run(patch[k], id);
    }
    this.db.prepare('UPDATE documents SET updated_at=? WHERE id=?').run(now(), id);
    return this.getDocument(id);
  }
  listDocuments({ collectionId = null, ownerUserId = null } = {}) {
    let sql = 'SELECT * FROM documents WHERE 1=1';
    const params = [];
    if (collectionId) { sql += ' AND collection_id=?'; params.push(collectionId); }
    if (ownerUserId) { sql += ' AND owner_user_id=?'; params.push(ownerUserId); }
    sql += ' ORDER BY created_at DESC';
    return this.db.prepare(sql).all(...params).map(rowToDocument);
  }
  deleteDocument(id) {
    this.db.prepare('DELETE FROM documents WHERE id=?').run(id);
    this.db.prepare('DELETE FROM document_access WHERE document_id=?').run(id);
    this.db.prepare('DELETE FROM chunks WHERE document_id=?').run(id);
    this.db.prepare('DELETE FROM vector_embeddings WHERE document_id=?').run(id);
    return true;
  }
  grantDocumentAccess(docId, granteeType, granteeId, permission = 'read', grantedBy = null) {
    this.db.prepare('INSERT INTO document_access (document_id,grantee_type,grantee_id,permission,granted_by,created_at) VALUES (?,?,?,?,?,?)')
      .run(docId, granteeType, granteeId, permission, grantedBy, now());
  }
  clearDocumentAccess(docId) {
    this.db.prepare('DELETE FROM document_access WHERE document_id=?').run(docId);
  }
  getDocumentGrants(docId) {
    return this.db.prepare('SELECT document_id,grantee_type,grantee_id,permission,granted_by FROM document_access WHERE document_id=?').all(docId)
      .map(r => ({ documentId: r.document_id, granteeType: r.grantee_type, granteeId: r.grantee_id, permission: r.permission, grantedBy: r.granted_by }));
  }
  canAccessDocument(docId, user) {
    const doc = this.getDocument(docId);
    if (!doc) return false;
    if (doc.ownerUserId === user.id) return true;
    const grants = this.getDocumentGrants(docId);
    const role = user.role || 'analyst';
    for (const g of grants) {
      if (g.granteeType === 'public') return true;
      if (g.granteeType === 'user' && g.granteeId === user.id) return true;
      if (g.granteeType === 'role' && g.granteeId === role) return true;
    }
    return false;
  }
  listAccessibleDocumentIds(user, { collectionId = null } = {}) {
    // IMPORTANT: do NOT pre-filter by owner here — documents granted to a user
    // or role are owned by OTHER users. Fetch all then scope explicitly.
    const all = this.listDocuments({ collectionId });
    const accessible = [];
    for (const d of all) {
      if (user.isAdmin || d.ownerUserId === user.id || this.canAccessDocument(d.id, user)) accessible.push(d.id);
    }
    return accessible;
  }
  listAccessibleDocuments(user, { collectionId = null } = {}) {
    const ids = new Set(this.listAccessibleDocumentIds(user, { collectionId }));
    return this.listDocuments({ collectionId }).filter(d => ids.has(d.id));
  }
  replaceChunksVectors(docId, chunks, vectors, dimension, provider) {
    const ts = now();
    const delChunks = this.db.prepare('DELETE FROM chunks WHERE document_id=?');
    const delVecs = this.db.prepare('DELETE FROM vector_embeddings WHERE document_id=?');
    const insChunk = this.db.prepare('INSERT INTO chunks (document_id,chunk_index,text,section,page,created_at) VALUES (?,?,?,?,?,?)');
    const insVec = this.db.prepare('INSERT INTO vector_embeddings (document_id,chunk_index,dimension,vector_json,provider,created_at) VALUES (?,?,?,?,?,?)');
    this.db.exec('BEGIN');
    try {
      delChunks.run(docId);
      delVecs.run(docId);
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        insChunk.run(docId, i, c.pageContent, c.metadata?.section || '', c.metadata?.page || 0, ts);
        const vec = vectors?.[i];
        if (vec && vec.length) insVec.run(docId, i, vec.length, JSON.stringify(vec), provider, ts);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return chunks.length;
  }
  getChunksForDocument(docId) {
    return this.db.prepare('SELECT chunk_index as chunkIndex, text, section, page FROM chunks WHERE document_id=? ORDER BY chunk_index').all(docId);
  }

  // ── Users (sovereign local auth) ────────────────────────────────────────
  createUser(u) {
    const id = u.id || uuid();
    const ts = now();
    this.db.prepare(`INSERT INTO users (id,employee_id,full_name,email,department,role,password_hash,status,
      must_change_password,auth_provider,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, u.employeeId || null, u.fullName, u.email.toLowerCase(), u.department || '', u.role || 'analyst',
        u.passwordHash || '', u.status || 'active', u.mustChangePassword ? 1 : 0, u.authProvider || 'local',
        u.createdBy || null, ts, ts);
    return this.getUser(id);
  }
  getUser(id) {
    const r = this.db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!r) return null;
    return { ...r, mustChangePassword: !!r.must_change_password, passwordHash: r.password_hash };
  }
  getUserByEmail(email) {
    const r = this.db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(email);
    if (!r) return null;
    return { ...r, mustChangePassword: !!r.must_change_password, passwordHash: r.password_hash };
  }
  getUserByEmployeeId(employeeId) {
    const r = this.db.prepare('SELECT * FROM users WHERE employee_id=?').get(employeeId);
    if (!r) return null;
    return { ...r, mustChangePassword: !!r.must_change_password, passwordHash: r.password_hash };
  }
  listUsers({ status = null, role = null } = {}) {
    let sql = 'SELECT id, employee_id, full_name, email, department, role, status, must_change_password, auth_provider, created_by, created_at, updated_at, last_login_at FROM users WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status=?'; params.push(status); }
    if (role) { sql += ' AND role=?'; params.push(role); }
    sql += ' ORDER BY created_at ASC';
    return this.db.prepare(sql).all(...params).map(r => ({ ...r, mustChangePassword: !!r.must_change_password }));
  }
  updateUser(id, patch) {
    const cur = this.db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!cur) return null;
    const allowed = ['employee_id', 'full_name', 'email', 'department', 'role', 'password_hash', 'status', 'must_change_password', 'auth_provider', 'last_login_at'];
    for (const k of allowed) {
      if (patch[k] !== undefined) {
        const v = k === 'email' ? String(patch[k]).toLowerCase() : patch[k];
        this.db.prepare(`UPDATE users SET ${k}=? WHERE id=?`).run(v, id);
      }
    }
    this.db.prepare('UPDATE users SET updated_at=? WHERE id=?').run(now(), id);
    return this.getUser(id);
  }
  updateUserLogin(id) {
    this.db.prepare('UPDATE users SET last_login_at=?, updated_at=? WHERE id=?').run(now(), now(), id);
  }
  recordSession(userId, ip, userAgent) {
    this.db.prepare('INSERT INTO user_sessions (user_id,ip,user_agent,created_at) VALUES (?,?,?,?)')
      .run(userId, ip || '', userAgent || '', now());
  }
  endSession(userId) {
    this.db.prepare('UPDATE user_sessions SET logout_at=? WHERE user_id=? AND logout_at IS NULL').run(now(), userId);
  }
  countUsers() {
    return this.db.prepare('SELECT COUNT(*) c FROM users').get().c;
  }
  getChunksByIds(docIds) {
    if (!docIds.length) return [];
    const marks = docIds.map(() => '?').join(',');
    return this.db.prepare(`SELECT document_id as documentId, chunk_index as chunkIndex, text, section, page FROM chunks WHERE document_id IN (${marks})`).all(...docIds);
  }
  getVectorsForDocuments(docIds) {
    if (!docIds.length) return [];
    const marks = docIds.map(() => '?').join(',');
    return this.db.prepare(`SELECT document_id as documentId, chunk_index as chunkIndex, dimension, vector_json as vectorJson, provider FROM vector_embeddings WHERE document_id IN (${marks})`).all(...docIds)
      .map(r => ({ ...r, vector: safeJson(r.vectorJson, []) }));
  }
  getDocumentByFilenamePrefix(prefix) {
    return rowToDocument(this.db.prepare('SELECT * FROM documents WHERE filename LIKE ? LIMIT 1').get(`%${prefix}%`));
  }
  // ── Document versioning (RAG hardening) ─────────────────────────────────
  findActiveByChecksum(checksum, collectionId = null) {
    if (!checksum) return null;
    let sql = 'SELECT d.*, (SELECT COUNT(*) FROM chunks c WHERE c.document_id=d.id) AS chunk_count FROM documents d WHERE d.checksum=? AND d.superseded=0';
    const params = [checksum];
    if (collectionId) { sql += ' AND d.collection_id=?'; params.push(collectionId); }
    return rowToDocument(this.db.prepare(sql + ' LIMIT 1').get(...params));
  }
  findLatestByFilename(filename, collectionId = null) {
    let sql = 'SELECT * FROM documents WHERE lower(filename)=lower(?) AND superseded=0';
    const params = [String(filename || '').trim()];
    if (collectionId) { sql += ' AND collection_id=?'; params.push(collectionId); }
    return rowToDocument(this.db.prepare(sql + ' ORDER BY created_at DESC LIMIT 1').get(...params));
  }
  previousActiveVersions(filename, collectionId = null) {
    let sql = 'SELECT * FROM documents WHERE lower(filename)=lower(?)';
    const params = [String(filename || '').trim()];
    if (collectionId) { sql += ' AND collection_id=?'; params.push(collectionId); }
    sql += ' ORDER BY created_at ASC';
    return this.db.prepare(sql).all(...params).map(rowToDocument);
  }
  // Supersedes every non-current version of a filename (keeps history + chain).
  markSuperseded(activeDocId, { exceptId = null } = {}) {
    const cur = this.getDocument(activeDocId);
    if (!cur) return 0;
    let sql = 'UPDATE documents SET superseded=1, updated_at=? WHERE lower(filename)=lower(?) AND id<>?';
    const params = [now(), cur.filename, activeDocId];
    if (exceptId) { sql += ' AND id<>?'; params.push(exceptId); }
    const r = this.db.prepare(sql).run(...params);
    return r.changes;
  }

  // ── Model registry ───────────────────────────────────────────────────────
  seedModelRegistry() {
    const count = this.db.prepare('SELECT COUNT(*) as c FROM model_registry').get().c;
    if (count > 0) return;
    const builtins = [
      ['reasoning_local', 'Local Reasoning Model (Qwen3 8B)', 'reasoning', ['text_generation', 'reasoning', 'structured_output', 'tool_calling'], 8, 'small'],
      ['coding_local', 'Local Coding Model (Qwen3 8B, MVP fallback)', 'coding', ['text_generation', 'coding', 'reasoning', 'structured_output'], 8, 'small'],
      ['vision_local', 'Local Vision Model (Qwen3-VL 8B)', 'vision', ['text_generation', 'vision', 'reasoning'], 8, 'small'],
      ['embedding_embed', 'Local Embedding Model (nomic-embed-text)', 'embedding', ['embedding'], 2, 'small'],
      ['reasoning_mid', 'Mid Reasoning Model (Qwen3 14B)', 'reasoning', ['text_generation', 'reasoning', 'structured_output', 'tool_calling', 'long_context'], 16, 'mid'],
      ['coding_mid', 'Mid Coding Model (Qwen3 Coder 30B-A3B)', 'coding', ['text_generation', 'coding', 'structured_output'], 16, 'mid'],
      ['vision_mid', 'Mid Vision Model (Qwen3-VL 32B)', 'vision', ['text_generation', 'vision', 'reasoning'], 32, 'mid'],
      ['reasoning_large', 'Large Reasoning Model (Qwen3 32B)', 'reasoning', ['text_generation', 'reasoning', 'structured_output', 'tool_calling', 'long_context'], 32, 'large'],
      ['coding_large', 'Large Coding Model (Qwen3 Coder 30B-A3B)', 'coding', ['text_generation', 'coding', 'reasoning', 'structured_output'], 32, 'large'],
      ['vision_large', 'Large Vision Model (Qwen3-VL 32B)', 'vision', ['text_generation', 'vision', 'reasoning'], 32, 'large'],
    ];
    const ts = now();
    const ins = this.db.prepare('INSERT INTO model_registry (id,model_key,name,role,capabilities_json,provider,status,vram_gb,profile,benchmark_json,is_builtin,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const [key, name, role, caps, vram, profile] of builtins) {
      ins.run(uuid(), key, name, role, JSON.stringify(caps), 'local', 'configured', vram, profile, '{}', 1, ts, ts);
    }
  }
  listModels() { return this.db.prepare('SELECT * FROM model_registry ORDER BY profile, role').all().map(rowToModel); }
  getModelByKey(modelKey) { return rowToModel(this.db.prepare('SELECT * FROM model_registry WHERE model_key=?').get(modelKey)); }
  upsertModel(m) {
    const existing = this.db.prepare('SELECT id FROM model_registry WHERE model_key=?').get(m.modelKey);
    const ts = now();
    if (existing) {
      this.db.prepare(`UPDATE model_registry SET name=?, role=?, capabilities_json=?, provider=?, status=?, vram_gb=?, profile=?, benchmark_json=?, updated_at=? WHERE model_key=?`)
        .run(m.name || existing.name, m.role || 'reasoning', JSON.stringify(m.capabilities || []), m.provider || 'local',
          m.status || 'configured', m.vramGb || 0, m.profile || 'small', JSON.stringify(m.benchmarks || {}), ts, m.modelKey);
      return this.getModelByKey(m.modelKey);
    }
    const id = m.id || uuid();
    this.db.prepare('INSERT INTO model_registry (id,model_key,name,role,capabilities_json,provider,status,vram_gb,profile,benchmark_json,is_builtin,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, m.modelKey, m.name || m.modelKey, m.role || 'reasoning', JSON.stringify(m.capabilities || []), m.provider || 'local',
        m.status || 'configured', m.vramGb || 0, m.profile || 'small', JSON.stringify(m.benchmarks || {}), m.isBuiltin ? 1 : 0, ts, ts);
    return this.getModelByKey(m.modelKey);
  }
  setModelStatus(modelKey, status) {
    this.db.prepare('UPDATE model_registry SET status=?, updated_at=? WHERE model_key=?').run(status, now(), modelKey);
    return this.getModelByKey(modelKey);
  }

  // ── Agent tasks / approvals ─────────────────────────────────────────────
  createTask(t) {
    const id = t.id || uuid();
    const ts = now();
    // Never persist an undefined/forged approval risk.
    const risk = ['low', 'medium', 'high'].includes(t.approvalRisk) ? t.approvalRisk : 'low';
    this.db.prepare(`INSERT INTO agent_tasks (id,user_id,user_email,title,question,task_type,model,workflow,status,
      plan_json,trace_json,sources_json,artifacts_json,approval_status,approval_risk,error,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, t.userId || null, t.userEmail || '', t.title || '', t.question, t.taskType || '', t.model || '',
        t.workflow || 'document_analysis', t.status || 'queued', JSON.stringify(t.plan || []), JSON.stringify(t.trace || []),
        JSON.stringify(t.sources || []), JSON.stringify(t.artifacts || []), t.approvalStatus || 'not_required',
        risk, t.error || '', ts, ts);
    return this.getTask(id);
  }
  getTask(id) { return rowToTask(this.db.prepare('SELECT * FROM agent_tasks WHERE id=?').get(id)); }
  updateTask(id, patch) {
    const cur = this.db.prepare('SELECT * FROM agent_tasks WHERE id=?').get(id);
    if (!cur) return null;
    const allowed = ['title', 'task_type', 'model', 'workflow', 'status', 'plan_json', 'trace_json', 'sources_json',
      'artifacts_json', 'approval_status', 'approval_risk', 'approver_user_id', 'approval_note', 'error', 'completed_at'];
    for (const k of allowed) {
      if (patch[k] !== undefined) this.db.prepare(`UPDATE agent_tasks SET ${k}=? WHERE id=?`).run(typeof patch[k] === 'string' ? patch[k] : JSON.stringify(patch[k]), id);
    }
    this.db.prepare('UPDATE agent_tasks SET updated_at=? WHERE id=?').run(now(), id);
    return this.getTask(id);
  }
  listTasks({ userId = null, status = null, limit = 100 } = {}) {
    let sql = 'SELECT * FROM agent_tasks';
    const params = [];
    const where = [];
    if (userId) { where.push('user_id=?'); params.push(userId); }
    if (status) { where.push('status=?'); params.push(status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return this.db.prepare(sql).all(...params).map(rowToTask);
  }
  addApproval({ taskId, userId, action, note = '' }) {
    this.db.prepare('INSERT INTO approvals (task_id,user_id,action,note,created_at) VALUES (?,?,?,?,?)')
      .run(taskId, userId || null, action, note, now());
  }
  getApprovals(taskId) {
    return this.db.prepare('SELECT task_id,user_id,action,note,created_at FROM approvals WHERE task_id=? ORDER BY id').all(taskId);
  }

  // ── Artifacts ───────────────────────────────────────────────────────────
  createArtifact(a) {
    const id = a.id || uuid();
    const ts = now();
    this.db.prepare('INSERT INTO artifacts (id,task_id,user_id,name,type,mime,path,size,meta_json,checksum,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, a.taskId || null, a.userId || null, a.name, a.type || '', a.mime || '', a.path || '', a.size || 0,
        JSON.stringify(a.meta || {}), a.checksum || '', ts);
    return this.getArtifact(id);
  }
  getArtifact(id) { return rowToArtifact(this.db.prepare('SELECT * FROM artifacts WHERE id=?').get(id)); }
  listArtifacts({ userId = null, limit = 100 } = {}) {
    const params = [];
    let sql = 'SELECT * FROM artifacts';
    if (userId) { sql += ' WHERE user_id=?'; params.push(userId); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return this.db.prepare(sql).all(...params).map(rowToArtifact);
  }

  // ── Audit ───────────────────────────────────────────────────────────────
  insertAudit(entry) {
    const id = uuid();
    const ts = new Date().toISOString();
    const last = this.db.prepare('SELECT seq, hash FROM audit_logs ORDER BY seq DESC LIMIT 1').get();
    const prevHash = last?.hash || 'GENESIS';
    const payload = JSON.stringify({ ts, user: entry.userEmail || entry.userId || '', cat: entry.category || 'system', act: entry.action, det: entry.details || {} });
    const hash = crypto.createHash('sha256').update(prevHash + payload).digest('hex');
    const seq = (last?.seq ?? 0) + 1;
    this.db.prepare('INSERT INTO audit_logs (id,seq,timestamp,user_id,user_email,session_id,category,action,severity,ip,user_agent,details_json,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, seq, ts, entry.userId || '', entry.userEmail || '', entry.sessionId || '', entry.category || 'system',
        entry.action || 'unknown', entry.severity || 'info', entry.ip || '', entry.userAgent || '',
        JSON.stringify(entry.details || {}), prevHash, hash);
    return { id, seq, hash, prevHash };
  }
  listAudit({ limit = 200, category = null, severity = null, since = null, until = null, includePruned = false } = {}) {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    const where = [];
    if (!includePruned) { where.push('pruned=0'); }
    if (category) { where.push('category=?'); params.push(category); }
    if (severity) { where.push('severity=?'); params.push(severity); }
    if (since) { where.push('timestamp>=?'); params.push(since); }
    if (until) { where.push('timestamp<=?'); params.push(until); }
    if (where.length) sql += ' AND ' + where.join(' AND ');
    sql += ' ORDER BY seq DESC LIMIT ?';
    params.push(limit);
    return this.db.prepare(sql).all(...params).map(rowToAudit);
  }
  verifyAuditChain() {
    const rows = this.db.prepare('SELECT * FROM audit_logs ORDER BY seq ASC').all();
    let prevHash = 'GENESIS';
    const failures = [];
    for (const r of rows) {
      if (r.prev_hash !== prevHash) failures.push({ seq: r.seq, expectedPrev: prevHash, gotPrev: r.prev_hash });
      const payload = JSON.stringify({ ts: r.timestamp, user: r.user_email || r.user_id || '', cat: r.category, act: r.action, det: safeJson(r.details_json, {}) });
      const calc = crypto.createHash('sha256').update(prevHash + payload).digest('hex');
      if (calc !== r.hash) failures.push({ seq: r.seq, integrity: 'hash_mismatch' });
      prevHash = r.hash;
    }
    return { intact: failures.length === 0, failures, count: rows.length };
  }

  // Re-link the hash chain after a detected, documented breakage. Only rows whose
  // stored hash disagrees with the recomputed hash are rewritten (minimal touch).
  // Callers must log an audit_chain_repair event explaining the cause.
  repairAuditChain() {
    const rows = this.db.prepare('SELECT * FROM audit_logs ORDER BY seq ASC').all();
    const update = this.db.prepare('UPDATE audit_logs SET prev_hash=?, hash=? WHERE seq=?');
    let prevHash = 'GENESIS';
    let repaired = 0;
    const touch = this.db.transaction(() => {
      for (const r of rows) {
        const payload = JSON.stringify({ ts: r.timestamp, user: r.user_email || r.user_id || '', cat: r.category, act: r.action, det: safeJson(r.details_json, {}) });
        const calc = crypto.createHash('sha256').update(prevHash + payload).digest('hex');
        if (r.prev_hash !== prevHash || calc !== r.hash) {
          update.run(prevHash, calc, r.seq);
          repaired++;
        }
        prevHash = calc;
      }
    });
    touch();
    return { repaired, count: rows.length };
  }
  pruneAudit(retentionDays) {
    // SOFT prune: rows age out of active listings (pruned=1) but their physical
    // rows + prev_hash/hash remain, preserving the tamper-evident chain.
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const r = this.db.prepare('UPDATE audit_logs SET pruned=1 WHERE timestamp<? AND pruned=0').run(cutoff);
    return { pruned: r.changes, retained: this.db.prepare('SELECT COUNT(*) c FROM audit_logs WHERE pruned=0').get().c, total: this.db.prepare('SELECT COUNT(*) c FROM audit_logs').get().c };
  }
  // Counts for the retention job: how many rows are OLDER than retention and
  // how many where soft-pruned already (used to avoid churn + emit telemetry).
  countExpiredAudit(retentionDays) {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    return this.db.prepare('SELECT COUNT(*) c FROM audit_logs WHERE timestamp<? AND pruned=0').get().c;
  }
  // Real telemetry counts used by the sovereignty dashboard (no fabricated zeroes).
  countAudit({ category = null, action = null, detailsLike = null } = {}) {
    let sql = 'SELECT COUNT(*) c FROM audit_logs WHERE 1=1';
    const params = [];
    if (category) { sql += ' AND category=?'; params.push(category); }
    if (action) { sql += ' AND action=?'; params.push(action); }
    if (detailsLike) { sql += ' AND details_json LIKE ?'; params.push(`%${detailsLike}%`); }
    return this.db.prepare(sql).get(...params).c;
  }
  exportAudit({ includePruned = true } = {}) {
    const sql = includePruned ? 'SELECT * FROM audit_logs ORDER BY seq ASC' : 'SELECT * FROM audit_logs WHERE pruned=0 ORDER BY seq ASC';
    return this.db.prepare(sql).all().map(rowToAudit);
  }

  // ── Backup / restore (WAL-safe, atomic via VACUUM INTO) ─────────────────
  integrityCheck() {
    return this.db.prepare('PRAGMA integrity_check').get().integrity_check;
  }
  // Checkpoint the WAL so a snapshot taken immediately afterwards is consistent.
  checkpoint() {
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); return true; } catch { return false; }
  }
  // VACUUM INTO produces a single consistent DB file; safe to read concurrently.
  backup(destPath) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const safe = String(destPath).replace(/'/g, "''");
    this.db.exec(`VACUUM INTO '${safe}'`);
    const info = { ok: true, path: destPath, size: fs.statSync(destPath).size, createdAt: now() };
    // Integrity of the backup file itself.
    const check = new DatabaseSync(destPath, { readOnly: true });
    try {
      info.integrity = check.prepare('PRAGMA integrity_check').get().integrity_check;
    } finally { check.close(); }
    return info;
  }
  openBackup(destPath) {
    const b = new DatabaseSync(destPath, { readOnly: true });
    return b.prepare('PRAGMA integrity_check').get().integrity_check === 'ok' ? b : (b.close(), null);
  }
  // Close current handle, copy an (integrity-verified) backup over the live file,
  // reopen. Returns the verification result of the restored database.
  restoreBackup(srcPath, { destination = null } = {}) {
    const target = destination || this.path;
    const check = new DatabaseSync(srcPath, { readOnly: true });
    let ok = check.prepare('PRAGMA integrity_check').get().integrity_check === 'ok';
    check.close();
    if (!ok) return { ok: false, error: 'Backup failed integrity check. Aborting restore.' };
    const tmp = `${target}.restore.tmp`;
    fs.copyFileSync(srcPath, tmp);
    this.close();
    fs.rmSync(target, { force: true });
    fs.renameSync(tmp, target);
    this.db = new DatabaseSync(target);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    const restored = { ok: true, integrity: this.db.prepare('PRAGMA integrity_check').get().integrity_check };
    this.db.exec('VACUUM'); // reclaim any copied-in free pages safely
    return restored;
  }

  // ── Sovereignty / usage ─────────────────────────────────────────────────
  recordSovereignty(event) {
    this.db.prepare('INSERT INTO sovereignty_events (event_type,destination,provider,success,detail_json,created_at) VALUES (?,?,?,?,?,?)')
      .run(event.eventType || 'system', event.destination || '', event.provider || '', event.success ? 1 : 0,
        JSON.stringify(event.detail || {}), now());
  }
  listSovereigntyEvents({ limit = 500 } = {}) {
    return this.db.prepare('SELECT * FROM sovereignty_events ORDER BY id DESC LIMIT ?').all(limit)
      .map(r => ({ id: r.id, eventType: r.event_type, destination: r.destination, provider: r.provider, success: !!r.success, detail: safeJson(r.detail_json, {}), createdAt: r.created_at }));
  }
  recordUsage(u) {
    this.db.prepare('INSERT INTO usage_logs (user_id,task_type,model,latency_ms,success,detail_json,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(u.userId || '', u.taskType || '', u.model || '', u.latencyMs || 0, u.success ? 1 : 0, JSON.stringify(u.detail || {}), now());
  }

  // ── Misc ────────────────────────────────────────────────────────────────
  getSeq() { return 'sqlite'; }
  stats() {
    return {
      collections: this.db.prepare('SELECT COUNT(*) c FROM collections').get().c,
      documents: this.db.prepare('SELECT COUNT(*) c FROM documents').get().c,
      chunks: this.db.prepare('SELECT COUNT(*) c FROM chunks').get().c,
      tasks: this.db.prepare('SELECT COUNT(*) c FROM agent_tasks').get().c,
      artifacts: this.db.prepare('SELECT COUNT(*) c FROM artifacts').get().c,
      audit: this.db.prepare('SELECT COUNT(*) c FROM audit_logs').get().c,
      events: this.db.prepare('SELECT COUNT(*) c FROM sovereignty_events').get().c,
      users: this.db.prepare('SELECT COUNT(*) c FROM users').get().c,
    };
  }
}

function rowToModel(r) {
  if (!r) return null;
  return {
    id: r.id, modelKey: r.model_key, name: r.name, role: r.role,
    capabilities: safeJson(r.capabilities_json, []), provider: r.provider, status: r.status,
    vramGb: r.vram_gb, profile: r.profile, benchmarks: safeJson(r.benchmark_json, {}),
    isBuiltin: !!r.is_builtin, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function rowToTask(r) {
  if (!r) return null;
  return {
    id: r.id, userId: r.user_id, userEmail: r.user_email, title: r.title, question: r.question,
    taskType: r.task_type, model: r.model, workflow: r.workflow, status: r.status,
    plan: safeJson(r.plan_json, []), trace: safeJson(r.trace_json, []),
    sources: safeJson(r.sources_json, []), artifacts: safeJson(r.artifacts_json, []),
    approvalStatus: r.approval_status, approvalRisk: r.approval_risk,
    approverUserId: r.approver_user_id, approvalNote: r.approval_note,
    error: r.error, createdAt: r.created_at, updatedAt: r.updated_at, completedAt: r.completed_at,
  };
}
function rowToArtifact(r) {
  if (!r) return null;
  return { id: r.id, taskId: r.task_id, userId: r.user_id, name: r.name, type: r.type, mime: r.mime, path: r.path, size: r.size, meta: safeJson(r.meta_json, {}), checksum: r.checksum, createdAt: r.created_at };
}
function rowToAudit(r) {
  return { id: r.id, seq: r.seq, timestamp: r.timestamp, userId: r.user_id, userEmail: r.user_email, sessionId: r.session_id, category: r.category, action: r.action, severity: r.severity, ip: r.ip, userAgent: r.user_agent, details: safeJson(r.details_json, {}), prevHash: r.prev_hash, hash: r.hash, pruned: !!r.pruned };
}

let _instance = null;

// Singleton accessor.
export function getSovereignDB() {
  if (!_instance) {
    _instance = new SovereignDB(sovereign.storage.sqlitePath).init();
  }
  return _instance;
}

export { safeJson };