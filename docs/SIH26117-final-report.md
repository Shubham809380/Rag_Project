# MRPL Sovereign AI Workbench — Final Completion Report
## SIH 26117 · Submission Date: 2026-09-13

---

## A. Environment

| Item | Value |
|------|-------|
| OS | Windows 11 (64-bit) |
| Node.js | v22.20.0 |
| Storage | SQLite (local sovereign DB) |
| Egress | `deny` (application-level; production requires OS firewall + physical isolation) |
| Demo Mode | `DEMO_MODE=true` (dev only; production ignores all forged headers) |

## B. Hardware

| Component | Detail |
|-----------|--------|
| GPU | NVIDIA RTX 2050 (4 GB VRAM) |
| RAM | 15.6 GB |
| Disk | C: 260 GB (31.5 GB free), E: 214 GB (151.8 GB free) |

## C. Local Inference Gateway — Ollama

| Item | Value |
|------|-------|
| Version | 0.34.0 |
| Endpoint | `http://127.0.0.1:11434` |
| Status | **Running** (winget install + manual start) |

## D. Models (6 installed · 4 routed slots · 3 unique routed · 3 unused)

| Slot | Model | Size | Role |
|------|-------|------|------|
| reasoning_local | llama3.2 | 2.0 GB | Reasoning / agent tasks |
| coding_local | llama3.2 | 2.0 GB | Code generation (sandbox) |
| vision_local | qwen3-vl:8b | 6.1 GB | Vision / OCR |
| embedding_embed | nomic-embed-text | 274 MB | Embeddings (768d) |
| (installed, not routed) | qwen3:8b | 5.2 GB | General reasoning |
| (installed, not routed) | qwen2.5-coder:3b | 1.9 GB | Coding |
| (installed, not routed) | tinyllama | 637 MB | Light tasks |

Model accounting: **6 installed** on the Ollama gateway · **4 routing slots**
configured (`small` profile) · **3 unique models actually routed** because
`llama3.2` serves both reasoning and coding · **3 installed but unused** are
labelled "Installed / Available but not currently routed" in the UI (never
presented as slot capacity). Slot count ≠ unique routed models ≠ installed
models — each is reported distinctly.

**Real inference verified**: llama3.2 replied `MRPL_SOVEREIGN_OK` (8 tokens, ~9 s cold).

## E. OCR — Tesseract

| Item | Value |
|------|-------|
| Version | 5.4.0.20240606 |
| Path | `C:\Program Files\Tesseract-OCR\tesseract.exe` |
| Status | **Available** (winget UB-Mannheim.TesseractOCR) |

**Real OCR verified**: transcribed `datasets/pump-p101-scanned-tag.png` → "PUMP P-101 / LOTO REQUIRED / Governing: SOP-07 Section 4.2 / SIMULATED EQUIPMENT TAG — DEMO ONLY".

## F. Vision — qwen3-vl:8b

| Item | Value |
|------|-------|
| Status | **Available** (real multimodal inference) |
| Speed | ~148 s per query (CPU+GPU hybrid on 4 GB VRAM) |

**Real vision verified**: described P-101 equipment tag and LOTO safety rule via Ollama `/api/chat`.

## G. Docker Sandbox

| Item | Value |
|------|-------|
| Version | 29.5.3 (Docker Desktop) |
| Status | **Daemon running**, `docker ps` works |
| Images | debian:bookworm-slim, python:3.12-slim |
| Sandbox flags | `--network none`, `-m 512m`, `--cpus 1.0` |

**Real sandbox verified**: `print(6*7)` → 42 inside container; `requests.get("https://example.com")` → **blocked** by static code guard.

## H. RAG Pipeline

| Component | Detail |
|-----------|--------|
| Vector store | SQLite + BM25 (hybrid) |
| Embeddings | nomic-embed-text via Ollama (768d) |
| Ingestion | extract → chunk → embed → index (local) |
| Search | BM25 + cosine similarity + MMR dedup |

**Real RAG verified**: queried "What LOTO isolation does pump P-101 require?" → 8 grounded chunks with page citations from scanned inspection report.

## I. Egress Guard Test

- Real outbound `fetch("https://example.com")` → **BLOCKED** (application egress guard, logged to audit).
- `egress_block` audit events recorded.
- Zero external API calls confirmed.

## J. Security Test (npm run test:security)

- Prompt injection classified honestly (4/4 cases).
- RBAC enforcement: inspector denied execute_python (level 2 tool), admin allowed.
- Approval gate: high-risk task stopped for human sign-off.
- Double-decision idempotently returns 409.
- Audit chain intact after security brief.

## K. npm Test Results (all green)

| Suite | Result | Notes |
|-------|--------|-------|
| `npm test` | **48/48 PASS** | Static code guard, RBAC, routing, audit chain, pipeline, sandbox, artifacts, grounded RAG, egress honesty |
| `npm run test:auth` | **21/21 PASS** | Bootstrap admin, password policy, JWT, user management, production header isolation, demo-mode path |
| `npm run test:security` | **9/9 PASS** | Injection classification, RBAC, approval gate, code guard, audit integrity |
| `npm run test:egress` | **PASS** | Real outbound blocked, audit intact |
| `npm run test:tools` | **8/8 PASS** | 14 tools registered, xlsx round-trip, execute_python isolated (42), grounded KB search |
| `npm run test:scanned` | **6/6 PASS** | Scanned-PDF → local OCR → RAG → grounded answer with page citation |
| `npm run eval` | **26/26 PASS** | Task classification, approval gating, registry routing, grounded RAG, egress guard, code guard, artifact generation, audit chain |
| `vite build` | **OK** | Production build, 2 chunks >500 KB (benign warnings) |
| `oxlint` | **Clean** | Only pre-existing fast-refresh warnings |

## L. Live E2E Demo (via /api/sovereign/tests/*)

| Test | Status | Latency | Detail |
|------|--------|---------|--------|
| auth | PASS | 0 ms | Demo admin identity verified |
| egress | PASS | 21 ms | Real outbound blocked |
| model | PASS | 6172 ms | llama3.2 local inference |
| ocr | PASS | 261 ms | Tesseract transcribed scanned image |
| rag | PASS | 1306 ms | Grounded "LOTO isolation" on 8 chunks |
| sandbox | PASS | 2177 ms | Docker --network none, Python 42, network refused |
| audit | PASS | 27 ms | SHA-256 chain verified (850+ events) |

## M. SIH 26117 Compliance (18 mapped requirements/evidence items)

The table maps the problem-statement capability set to 18 evidence items. These are
the **mapped** requirement/evidence items used by this submission, not an official
numbered list from the problem statement. Full legend + evidence strings per row:
`docs/SIH26117-compliance.md`.

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Working local deployment on mid-range GPU (no cloud) | VERIFIED |
| 2 | Multiple models + automatic task-based selection (≥2 task types) | VERIFIED |
| 3 | End-to-end agentic task (scan → inspection → Word report + approval) | VERIFIED |
| 4 | Coding task in isolated sandbox | VERIFIED |
| 5 | Multimodal (scanned image / drawing understanding) | VERIFIED |
| 6 | Visible zero-external-call proof (sovereignty monitor) | VERIFIED |
| 7 | On-prem KB connector (SOPs, manuals, correspondence) | VERIFIED |
| 8 | Real deliverables (Word/Excel/PPT/PDF/files/code) | VERIFIED |
| 9 | Statistical & analytical analysis | PARTIAL |
| 10 | Multilingual support | PARTIAL |
| 11 | Security & access control (login, RBAC, data protection) | VERIFIED |
| 12 | Honesty under failure (no fabrication, no cloud fallback) | VERIFIED |
| 13 | Human-in-the-loop approval | VERIFIED |
| 14 | Tamper-evident audit (blockchain-based evidence) | PARTIAL — SHA-256 chain VERIFIED; **blockchain NOT IMPLEMENTED** (deployment extension) |
| 15 | No-breakdown / fail without loss | VERIFIED (tested fail-closed degrades) — recovery drill: DESIGNED ONLY |
| 16 | Fault tolerance & data recovery | DESIGNED ONLY |
| 17 | Independent classification without dataset | DESIGNED ONLY |
| 18 | Plugin integration (upload / view / document handling) | VERIFIED |

**Status rollup: TOTAL 18 = VERIFIED 13 + PARTIAL 3 (`#9`, `#10`, `#14`) + DESIGNED ONLY 2 (`#16`, `#17`) + NOT IMPLEMENTED 0 (standalone).**
Row `#14` is counted `PARTIAL` — the SHA-256 tamper-evidence hash chain is implemented
and verified, while the blockchain mechanism inside that requirement is explicitly
**NOT IMPLEMENTED** and disclosed as a deployment extension.

Full status legend + evidence strings for every row: `docs/SIH26117-compliance.md`.

## N. Limitations (honest disclosure)

1. **App-layer egress guard** is an application-level control, not an OS firewall. The verified statement is: *"the application enforces sovereign-mode outbound request denial at the application layer."* Production additionally requires OS/network-level firewall controls and physical network isolation — the workbench does **not** claim to enforce a physical air-gap.
2. **4 GB VRAM** limits 8B vision model to CPU-swapped execution (~148 s/query on qwen3-vl:8b). On GPU-equipped hosts this drops to ~5 s.
3. **Tesseract** requires Windows install path in `PATH` or fallback; workbench auto-detects both.
4. **Blockchain** tamper-evidence: SHA-256 hash chain is VERIFIED; distributed ledger integration is NOT IMPLEMENTED (documented deployment extension).
5. **PaddleOCR** not installed (optional); Tesseract fills the OCR role.
6. **3 installed models are not currently routed** (qwen3:8b, qwen2.5-coder:3b, tinyllama) — labelled "Installed / Available but not currently routed".

## O. Startup Commands

```bash
# Start Ollama (if not running)
ollama serve

# Start Docker Desktop (if not running)
# Then pull sandbox images:
docker pull python:3.12-slim
docker pull debian:bookworm-slim

# Start the workbench
node server.js          # http://localhost:5000

# Frontend dev (optional, for UI)
cd frontend && npm run dev   # http://localhost:5173
```

## P. Judge Demo Script (7 minutes)

1. Start server → startup banner shows live OCR/Docker/Models status.
2. Navigate to `/workbench/judge`.
3. Top verdicts: Egress Guard Active, Audit Chain Intact, Local-first Router.
4. Runtime Capabilities: 6 installed models / 4 routing slots (3 unique routed, 3 unused listed), tesseract=true, Docker=AVAILABLE.
5. Click **Run Full Demo** → 7 real checks stream results with PASS/FAIL/UNAVAILABLE chips.
6. Expand any result for detailed logs (latency, model, OCR text, sandbox output).
7. Requirement Evidence table shows all SIH requirements with VERIFIED/PARTIAL/DESIGNED status.
8. Reproducible commands: `npm test` (48/48), `npm run test:scanned` (6/6), `npm run eval` (26/26).

## Q. Production Requirements

1. **Network isolation**: OS-level firewall blocking all outbound (not just app-level).
2. **Physical air-gap**: No internet connection to the host machine.
3. **GPU upgrade**: Minimum 8 GB VRAM recommended for comfortable 8B vision inference.
4. **Backup**: SQLite file backup + audit export (JSONL) for compliance.
5. **Monitoring**: Extend `sovereign/monitor` for production alerting.
6. **JWT secret**: Replace default with a strong random secret in production.
7. **Admin password**: The default dev-bootstrap admin password must be changed to a strong random secret before production (value never printed in this report).
