# Sovereign Workbench — SQLite Schema (sovereign/data/sovereign.sqlite)

Created by `backend/storage/sovereignDB.js`. `getSovereignDB()` is a singleton;
all sovereign tables live here regardless of the classic app's Postgres store.

## Tables

### `collections`
| column | notes |
|--------|-------|
| id | uuid PK |
| name, description, department | |
| owner_user_id | |
| created_at, updated_at | |

### `documents`
| column | notes |
|--------|-------|
| id | uuid PK |
| filename, file_type, file_size | |
| collection_id | |
| classification | PUBLIC / INTERNAL / CONFIDENTIAL / RESTRICTED |
| department, version, source | metadata per §5 |
| file_path, checksum | durable original (for OCR/vision tools) |
| pages | |
| status | pending / ocr_required / indexed / ready / embed_failed / empty |
| owner_user_id | ownership ⇒ read+write |
| metadata_json, created_at, updated_at | |

### `chunks` + `vector_embeddings`
- `chunks`: document_id, chunk_index, text, section, page, created_at
- `vector_embeddings`: document_id, chunk_index, dimension, vector_json, provider, created_at
- Access scope is applied at query time (classification + grants), not baked in rows.

### `document_access`
Grant rows: `grantee_type` public/user/role, `grantee_id`, `permission`,
`granted_by`. `listAccessibleDocumentIds()` enforces ownership + grants.

### `model_registry`
`model_key` (slot), name, role, `capabilities_json`, provider, status
(configured/available/unavailable), vram_gb, profile (small/mid/large),
`benchmark_json`, is_builtin. Actual gateway id resolved via `MODEL_SLOTS`.

### `agent_tasks`
id, user_id, user_email, title, question, task_type, model, workflow, status,
`plan_json`, `trace_json`, `sources_json`, `artifacts_json`, approval_status,
approval_risk, approver_user_id, approval_note, error, timestamps.

### `task_approvals`
task_id, approver user/email, decision (approved/rejected), note, created_at.

### `artifacts`
id, task_id, user_id, name, type, mime, path, size, `meta_json`, checksum
(sha256), created_at.

### `audit_logs` (tamper-evident)
seq (monotonic), timestamp, user_id, user_email, session_id, category, action,
severity, ip, user_agent, `details_json`, **prev_hash**, **hash**.
`hash = sha256(prev_hash + payload)`; `verifyAuditChain()` re-walks the chain.
Mirrored to JSONL in `sovereign/audit/` when `SOVEREIGN_AUDIT_JSONL=true`.

### `sovereignty_events`
Monitored network/model events from the egress guard: event_type
(egress_block / egress_attempt / probe / local_model), destination, provider,
success, detail_json, created_at. This is the real-data source for the
sovereignty dashboard counters.

### `usage_logs`
user_id, task_type, model, latency_ms, success, detail_json, created_at.

## Postgres (`SOVEREIGN_STORAGE=postgres`)
Migrated via the classic `backend/migrate*.js`; the SQLite domain remains the
offline source of truth. A network-isolated host simply never connects.