# Phase 33 — Engineering Completion Report

**Project:** InsightRAG Sovereign Workbench — Sovereign On-Premise Agentic AI
Workbench using Open-Weight Multimodal LLMs for Confidential Industrial Work
(delivered against the MRPL PS-26117 mission brief).

**Date:** 2026-09-06
**Environment:** Windows 11 · Node 22.20.0 · SQLite (local domain) · local Ollama 0.32.11
**Profile:** `small` (qwen3:8b / qwen3-vl:8b / nomic-embed-text) · egress `deny`

---

## FINAL STATUS

A **full working, air-gap-capable product** (not a demo). Every flagship capability
is implemented and verified with real automated suites. Where the host lacks a
dependency (Docker, poppler, Tesseract, GPU), the workbench **honestly refuses**
rather than faking output or falling back to the cloud. A true NIC-off proof was
out of scope on this always-online host; instead the process-level egress guard
is proven to defeat outbound `fetch`/DNS in `deny` mode.

## VERIFIED CAPABILITIES

1. **Local SQLite domain** — documents, chunks, vectors, tasks, artifacts, audit;
   hot-pluggable Postgres backend.
2. **Hybrid retrieval** — BM25 + cosine + MMR, access-scoped, with page/section
   citations and confidence; deterministic fallback embedder when no local model.
3. **Offline task classification** (`classifier.js`) — auditable, reproducible, no
   model needed; adversarial prompts still yield a local-only route.
4. **Risk gating + mandatory HITL approval** — high risk (approval/procurement
   notes, safety, spend) stops for a human; enforced at the **orchestrator** (403/409
   survive HTTP-layer bypass).
5. **Honest generation boundary** — no local model ⇒ `model_unavailable` packet,
   never fabricated content.
6. **Scanned-PDF → local OCR → vision → RAG → grounded answer** — flagship path
   fully live: text-free PDFs are rasterised in-process (pdf.js) and transcribed by
   `qwen3-vl:8b`; blank scans yield `EMPTY_DOCUMENT`, never fabricated text.
7. **14 permission-gated tools** — KB search, read doc, OCR, analyze image,
   read/write Excel, calculate, sandboxed Python, run tests, Word/PDF/PPTX
   generation, file read/write.
8. **Content-addressed Office/PDF artifacts** — docx/xlsx/pptx validated as
   real OOXML zip parts; xlsx now ingests as searchable text too.
9. **Egress guard** — process-level patch denies outbound in `deny` mode and logs
   every block to the audit trail.
10. **Tamper-evident audit chain** — hash-linked rows with `repairAuditChain()`;
    verified `intact` after every suite.
11. **Frontend** — Workbench / Documents / Audit / Dashboard pages surface routing
    reasons, model status, approval gates, packet + trace; `vite build` passes.
12. **Deterministic Excel workflow** (`npm run excel`) — produces a real
    `reliability-analysis.xlsx` + CSV packet with an audited run.

## MODELS

| Slot (`small`) | Gateway id | Status |
|----------------|-----------|--------|
| reasoning / agent / document | `qwen3:8b` | available |
| vision / OCR | `qwen3-vl:8b` | available (live OCR proven) |
| embeddings | `nomic-embed-text` | available (768-d) |
| also present | `llama3.2`, `tinyllama` | — |

Statuses: `available | unavailable | degraded | error`. `degraded` is fed by real
invocation failures (TTL 10 min); `decide()` always emits a human-readable
`reason` and a `model_selected` audit event. Missing ⇒ honest `model_unavailable`.

## E2E RESULTS

| Scenario | Result |
|----------|--------|
| Scanned PDF (PNG label embedded, no text layer) → OCR → RAG → LOTO answer | ✓ route `ocr`, 1 chunk, grounded answer with page citation |
| Blank scanned PDF | ✓ honest `EMPTY_DOCUMENT` (no fabricated text) |
| Image upload → vision OCR + `analyze_image` (provenance) | ✓ live `qwen3-vl:8b` |
| Approval-note task (high risk) → gate → supervisor approve/reject | ✓ 403/409/approval contract |
| xlsx upload → `read_excel` rows (no formulas) + `write_excel` artifact read-back | ✓ |
| Excel analysis workflow → `reliability-analysis.xlsx` + CSV | ✓ audited artifact |
| Sandboxed Python | ✓ honest `SANDBOX_UNAVAILABLE` (no Docker); static guard verified |
| Prompt injection ×3 | ✓ always routed local-only |
| Outbound fetch in `deny` mode | ✓ intercepted + `EGRESS BLOCKED` logged |

## SECURITY RESULTS

- Prompt injection (3 payloads): **local-only route every time**.
- Unauthorized approval: **403** at the orchestrator.
- Approval bypass: **prevented** — high risk stops for a human.
- Double decision: **409**.
- Static code guard: blocks `os`, `socket`, `urllib`, `requests`,
  `importlib.import_module` (7 patterns).
- No cloud fallback (Gemini/Pinecone/Neon) in local mode — proven by eval #3.
- Audit chain `intact` after every suite (count ~270+ rows).

## AIR-GAP RESULT

Fully air-gap capable: local inference + local retrieval + local OCR + local
artifacts + local audit. Egress guard defeats outbound in `deny` mode. True NIC-off
was not provable on this host (needs an admin adapter toggle) — documented as a
limitation; the process-level guard is the enforced control. Docker/popl
per are optional and degrade honestly.

## TEST SUMMARY

| Suite | Result |
|-------|--------|
| `npm run eval` | **26/26 PASS** |
| `npm test` (fast) | **48/48 PASS** |
| `npm run test:tools` | 7/7 (9/9 live) PASS |
| `npm run test:scanned` (live) | **6/6 PASS** |
| `npm run test:security` | **9/9 PASS** |
| `npm run test:egress` | PASS |
| `npm run test:docker` | SKIPPED (refusal verified; needs Docker host) |
| frontend `vite build` | ✓ |

Full detail: `docs/test-report.md`.

## REMAINING LIMITATIONS

1. **True NIC-off not executed** — host stayed online; egress-guard evidence used.
2. **No Docker** — code sandbox ships as static guard + honest refusal.
3. **No Tesseract/PaddleOCR** — image OCR relies on the local vision model (live).
4. **CPU-only throughput** — vision OCR ~100–140 s/page on `small` profile; expected;
   `LOCAL_GATEWAY_TIMEOUT_MS` set to 600 s.
5. **Postgres/Neon unreachable** — SQLite is the working air-gapped backend.
6. **Vision output is advisory** — labelled unverified / human review required; never
   a safety-certified conclusion.
7. **Demo role header** — `x-sovereign-role` / demo user replace real auth locally
   (documented; swap in production deployments).

## FILES MODIFIED / ADDED

- **OCR core:** `backend/ocr/ocrService.js`, `backend/ocr/pdfRasterizer.js` (new),
  `backend/rag/sovereignPipeline.js`, `backend/rag/chunker.js`.
- **Models:** `backend/models/registry.js`, `backend/models/router.js`,
  `backend/models/health.js`, `backend/models/capabilities.js`, `backend/models/classifier.js`.
- **Agents / tools:** `backend/agents/orchestrator.js`, `backend/agents/taskRouter.js`,
  `backend/agents/workflows.js`, `backend/tools/*` (registry + impl incl.
  `spreadsheetTools.js`), `backend/sandbox/docker.js`, `backend/sandbox/codeguard.js`.
- **Providers / security / storage:** `backend/providers/local.js`,
  `backend/security/audit.js`, `backend/security/policy.js`, `backend/storage/sovereignDB.js`,
  `backend/config/sovereign.js`, `backend/services/document.service.js` (xlsx ingest).
- **Controllers / routes / UI:** `backend/controllers/sovereign.controller.js`,
  `backend/routes/sovereign.routes.js`, `server.js`, `frontend/src/pages/AgentWorkbench.jsx`,
  `SovereignDashboard.jsx`, `SovereignDocuments.jsx`, `SovereignAudit.jsx`, `services/sovereign.js`.
- **Deployment:** `infrastructure/docker/Dockerfile` (new), `docker-compose.yml`,
  `infrastructure/airgap/airgap-bundle.ps1`, `infrastructure/nginx/sovereign.conf`.
- **Eval/docs:** `evaluation/run-tests.js`, `run-eval.js`, `tool-smoke.js` (new),
  `scanned-doc-e2e.js` (new), `security-brief.js` (new), `egress-block-evidence.js` (new),
  `docker-integration.js` (new), `lib/zipreader.js`, `scripts/demo-seed.js`,
  `scripts/demo-excel-analysis.js` (new), `scripts/demo-run.js`, `package.json`,
  `.env.example`, `docs/security.md`, `docs/model-cards.md`, `docs/deployment.md`,
  `docs/test-report.md` (new), `docs/phase33-report.md` (this file).

## HOW TO RUN

```bash
npm install
npm run seed          # ingest sample SOP/policy/LOTO KB (+ equipment-list.xlsx)
npm run demo          # deterministic walkthrough
npm run eval          # 26 self-checks
npm test              # 48 fast checks
npm run test:scanned  # flagship scanned-PDF → OCR → RAG (live vision)
npm run test:security # injection / approval / code-guard
npm run excel         # Excel analysis workflow → reliability-analysis.xlsx
npm start             # server on http://localhost:4877
# UI: /workbench, /workbench/agent, /workbench/documents, /workbench/audit
```

For a local model gateway (optional): `ollama pull qwen3:8b qwen3-vl:8b nomic-embed-text`.
