# InsightRAG + Sovereign AI Workbench

Document analysis, RAG, and agentic workflows over your documents — including an
**air-gapped "Sovereign" workbench** that can run with zero cloud access.

> **Precision note:** "air-gapped" here means **application-layer** exclusion of the
> cloud: the server enforces `SOVEREIGN_EGRESS=deny` (outbound fetch/http/https/DNS to
> non-private hosts are blocked and logged) and the model router is local-only with no
> cloud fallback. A full production air-gap additionally requires OS/network firewall
> controls and physical network isolation, which this workbench does not pretend to
> enforce (see `docs/SIH26117-final-report.md` §N and the Judge page honesty notice).

## Fast start (air-gapped, no API keys)

```bash
npm install            # backend deps (SQLite, docx/pdf/pptx, tools)
npm run seed           # ingest a sample SOP/policy/LOTO knowledge base
npm run eval           # 26 automated self-checks (routing, gating, RAG, egress, tools, audit)
npm run demo           # deterministic end-to-end walkthrough
npm run demo:flagship  # SIH26117 "killer demo": scanned inspection report → approval
                       #   gate → manager approve → retrieval → routing → .docx deliverable
                       #   → sovereignty report (0 outbound, local-only model calls)
npm run assets         # (re)generate the SIMULATED dataset files in datasets/
npm start              # server on http://localhost:4877
```

Open:
- `/workbench` — status, models, collections, documents
- `/workbench/agent` — workbench task composer (approval gate, packet, trace)
- `/workbench/documents` — upload + ingest
- `/workbench/audit` — verified hash-chain audit log

Dataset folder `datasets/` holds synthetic sample inputs (scanned tag PNG,
inspection report, telemetry CSV) — all clearly labelled **SIMULATED** for
demonstration only (see `datasets/README.md`).

## What is verified to work today (no cloud, no GPU)

- Local SQLite domain (documents, chunks, vectors, tasks, artifacts, audit)
- Text extraction + chunking + **hybrid retrieval** (BM25 + cosine + MMR) with
  access scoping and citations; fallback hash embeddings when no local model
- Offline rule-based **task classification**, risk gating, and mandatory human
  approval for high-risk tasks (`approval_note`, spend requests)
- Honest generation boundary: no local model ⇒ `model_unavailable` packet, no
  fabricated artifact
- Content-addressed **docx/xlsx/pdf/pptx** artifact generation
- **Egress guard** (denies outbound fetch/http/https/dns in local mode) + hash
  chained audit trail; RBAC + tool permission matrix
- Sandboxed Python via Docker (`--network none`) with a static guard — refuses
  honestly when Docker is absent

## With a local model gateway (optional)

Configure `LOCAL_GATEWAY_BASE` / `SOVEREIGN_HW_PROFILE` (see `.env.example`).
Pull the MVP stack on the gateway host:

```bash
ollama pull qwen3:8b qwen3-vl:8b nomic-embed-text
```

Once models report `available`, the classifier → registry → router path switches
from honest-block to real local inference for reasoning, vision and OCR.

## Documentation

- [Architecture](docs/architecture.md)
- [Security model & threat model](docs/security.md)
- [Model cards (Qwen3 MVP stack)](docs/model-cards.md)
- [Database schema](docs/db-schema.md)
- [Limitations & risk register](docs/limitations.md)
- [Deployment / air-gap bundling](docs/deployment.md)
- [Sovereign API reference](docs/api.md)
- [Test report (live suite results)](docs/test-report.md)
- [Phase 33 engineering report](docs/phase33-report.md)

## Verification suites

| Command | Scope |
|---------|-------|
| `npm run eval` | 26 self-checks: routing, gating, RAG + access control, egress, tools, artifacts, audit |
| `npm test` | 48 fast unit/integration checks (no live LLM) |
| `npm run test:tools` | tool smoke; add `TESTS_LIVE_LLM=1` (`npm run test:tools-live`) for live OCR/vision |
| `npm run test:scanned` | flagship scanned-PDF → local OCR → RAG → grounded answer (live vision) |
| `npm run test:security` | prompt injection ×3, unauthorized approval, approval bypass, double decision, code guard |
| `npm run test:egress` | process-level egress guard blocks outbound fetch in `deny` mode |
| `npm run test:docker` | isolated Docker sandbox (skipped here — honest refusal verified elsewhere) |
| `npm run excel` | deterministic Excel analysis workflow → `reliability-analysis.xlsx` artifact |

## Layout

```
backend/   server, services, agents, models, RAG, tools, sandbox, security, storage
frontend/  React + Vite UI (insightrag classics + workbench pages)
scripts/   demo-seed.js, demo-run.js
evaluation/ run-eval.js (25 self-checks)
infrastructure/ docker-compose, nginx, airgap bundle helper
docs/      architecture, security, model cards, db schema, limitations, deployment, api
```