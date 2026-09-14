# Sovereign Workbench — API

Base path `/api/sovereign`. `optionalAuth` middleware; in local/demo mode an
unauthenticated user is derived from the `x-sovereign-role` header (default
`inspector`).

## Status & models

- `GET /api/sovereign/status` — mode, gateway, hardware profile, monitor/DB health, model registry snapshot.
- `GET /api/sovereign/dashboard` — counts (documents, chunks, tasks, artifacts, audit), verification summary.
- `GET /api/sovereign/models` — registry detail (`configured` vs `available`).
- `GET /api/sovereign/availability` — per-task: role, required capabilities, could-run, reason.

## Collections & documents

- `GET|POST /api/sovereign/collections` — list / create (name, department, description).
- `GET /api/sovereign/documents` — list with classification, status, size, pages.
- `GET /api/sovereign/documents/:id` — detail.
- `POST /api/sovereign/documents` — upload (`multipart form-data`: `file`, optional `classification`, `department`). Ingests: extract → chunk → embed → index; keeps a durable source copy for OCR/vision.
- `GET /api/sovereign/documents/:id/source` — the stored original (served via `sovereignSourceUrl`).

## Tasks (agentic + approval)

- `POST /api/sovereign/tasks/start` — body `{ input, classification?, collectionId?, images? }`. Classifies, gates, creates a task. Returns `awaiting_approval` (when gated) or `running`.
- `GET /api/sovereign/tasks/:id` — task detail + packet + trace.
- `GET /api/sovereign/tasks` — list, filter `status`.
- `POST /api/sovereign/tasks/:id/approve` — body `{ approverId?, note? }`. Re-runs POST_GEN with approved status. Requires an approver role (engineer/manager/reviewer/admin).
- Lifecycle: `pending → awaiting_approval → (approved|rejected) → executed → completed | model_unavailable`.

## Artifacts

- `GET /api/sovereign/artifacts` — list (name, type, size, checksum, taskId, createdAt).
- `GET /api/sovereign/artifacts/:id/download` — file download.

## Tools & audit

- `GET /api/sovereign/tools` — registered tools + permission levels.
- `GET /api/sovereign/audit?limit=200&category=&severity=` — audit log with `chainVerified { intact, count, failures }`.

## Honesty contract

- A completion is `completed` **only** when a real local model produced the
  deliverable artifact. Otherwise the task is `model_unavailable` with
  `packet` (sources, calculations, comparisons, plan, trace) — never
  hallucinated fill-in.
- Approval is never granted by the agent; it is a distinct human step recorded
  in the audit trail (`approval` category).