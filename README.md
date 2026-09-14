# InsightRAG — Sovereign AI Workbench

> **A full-stack, air-gapped sovereign AI platform** for industrial document analysis, RAG, agentic workflows, and evidence-grounded deliverable generation — running **100% locally** with zero cloud dependency.

---

## System Architecture — Judge-Facing Version

```
                    ┌──────────────────────────────────────┐
                    │        INDUSTRIAL USER / ADMIN        │
                    │ Engineer • Manager • Analyst • IT     │
                    └──────────────────┬───────────────────┘
                                       │
                                       ▼
              ┌────────────────────────────────────────────┐
              │       SOVEREIGN AI WORKBENCH UI            │
              │ React / Vite • RBAC • Dashboard • Uploads  │
              └────────────────────┬───────────────────────┘
                                   │
                                   ▼
        ┌────────────────────────────────────────────────────────┐
        │             SECURE APPLICATION / API LAYER             │
        │ Express API • JWT • RBAC • Validation • Audit Control  │
        └───────────────┬───────────────────────┬────────────────┘
                        │                       │
          ┌─────────────▼────────────┐   ┌─────▼─────────────────┐
          │    DOCUMENT INGESTION    │   │   AGENTIC ORCHESTRATOR │
          │                          │   │                        │
          │ PDF / DOCX / XLSX / IMG  │   │ Task Planning          │
          │ Magic-byte validation    │   │ Model Selection        │
          │ Deduplication            │   │ Tool Selection         │
          │ Versioning               │   │ Multi-step Execution   │
          └─────────────┬────────────┘   └──────────┬─────────────┘
                        │                           │
                        ▼                           ▼
       ┌───────────────────────────┐     ┌──────────────────────────┐
       │   LOCAL MULTIMODAL AI     │     │      LOCAL TOOLS         │
       │                           │     │                          │
       │ OCR → Tesseract           │     │ File Read / Write        │
       │ Vision → Qwen3-VL        │     │ Spreadsheet Processing   │
       │ Embeddings → Nomic        │     │ Calculations             │
       │ LLM → Ollama Models       │     │ Code Execution           │
       └─────────────┬─────────────┘     └────────────┬─────────────┘
                     │                                │
                     └──────────────┬─────────────────┘
                                    ▼
                    ┌─────────────────────────────────┐
                    │        SOVEREIGN RAG             │
                    │                                 │
                    │ Local Knowledge Base             │
                    │ BM25 + Embeddings               │
                    │ Relevance Threshold              │
                    │ Version-aware Retrieval          │
                    │ Conflict Detection               │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │     EVIDENCE-GROUNDED RESULT     │
                    │                                 │
                    │ Verified Facts                   │
                    │ AI Observations                  │
                    │ Uncertainty / Conflicts          │
                    │ Source References                 │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │       HUMAN-IN-THE-LOOP          │
                    │                                 │
                    │ Review → Approve / Reject        │
                    │ Approval Gate                    │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                 ┌────────────────────────────────────────┐
                 │       LOCAL DELIVERABLE ENGINE         │
                 │                                        │
                 │ Approval Note • DOCX • PDF • XLSX     │
                 │ PPTX • Code • Analysis Reports         │
                 └──────────────────┬─────────────────────┘
                                    │
                                    ▼
                 ┌────────────────────────────────────────┐
                 │      AUDIT & GOVERNANCE LAYER          │
                 │                                        │
                 │ SHA-256 Tamper-Evident Audit Chain     │
                 │ User / Action / Timestamp / Artifact   │
                 │ Backup • Retention • Integrity Check   │
                 └────────────────────────────────────────┘


        ╔══════════════════════════════════════════════════════╗
        ║            SOVEREIGNTY / SECURITY PLANE             ║
        ║                                                      ║
        ║  LOCAL ONLY  │  EGRESS DENY  │  RBAC  │  LOGGING    ║
        ║  NO CLOUD    │  NETWORK NONE │  SANDBOX │  SECRETS  ║
        ╚══════════════════════════════════════════════════════╝
```

---

## Features

| Layer | What it does |
|-------|-------------|
| **Sovereign UI** | React + Vite dashboard with RBAC, document uploads, workbench, audit viewer |
| **Secure API** | Express 5 + JWT auth, role-based access control, input validation, rate limiting |
| **Document Ingestion** | PDF / DOCX / XLSX / image upload with magic-byte validation, deduplication, versioning |
| **Agentic Orchestrator** | Task planning, model selection, tool routing, multi-step execution with approval gates |
| **Local Multimodal AI** | OCR (Tesseract), Vision (Qwen3-VL), Embeddings (Nomic), LLM (Ollama) — all local |
| **Local Tools** | File I/O, spreadsheet processing, calculations, sandboxed code execution |
| **Sovereign RAG** | Hybrid BM25 + cosine retrieval, relevance threshold, version-aware, conflict detection |
| **Evidence-Grounded Results** | Verified facts, AI observations, uncertainty flags, source citations |
| **Human-in-the-Loop** | Approval gates for high-risk tasks — review, approve, or reject |
| **Deliverable Engine** | Content-addressed DOCX / PDF / XLSX / PPTX / code artifact generation |
| **Audit & Governance** | SHA-256 tamper-evident audit chain, backup, retention, integrity checks |
| **Security Plane** | Local-only execution, egress deny, RBAC, sandboxing, secrets management |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Ollama** (optional, for local LLM inference)
- **Docker** (optional, for sandboxed code execution)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/Shubham809380/Rag_Project.git
cd Rag_Project

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Seed sample knowledge base
npm run seed

# Start the server
npm start
# → http://localhost:4877
```

### Local Model Gateway (Optional)

For full AI capabilities, pull models into Ollama:

```bash
ollama pull qwen3:8b
ollama pull qwen3-vl:8b
ollama pull nomic-embed-text
```

Set `LOCAL_GATEWAY_BASE=http://127.0.0.1:11434` in `.env`.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server on http://localhost:4877 |
| `npm run seed` | Ingest sample SOP/policy/LOTO knowledge base |
| `npm run demo` | Deterministic end-to-end walkthrough |
| `npm run demo:flagship` | Full flagship demo: scanned report → approval → deliverable |
| `npm run assets` | Regenerate simulated dataset files |
| `npm run excel` | Excel analysis workflow |
| `npm run eval` | 26 automated self-checks |
| `npm test` | 48 unit/integration tests |
| `npm run test:tools` | Tool smoke tests |
| `npm run test:scanned` | Scanned PDF → OCR → RAG → grounded answer |
| `npm run test:security` | Prompt injection, unauthorized approval, bypass tests |
| `npm run test:egress` | Egress guard verification |
| `npm run test:auth` | Authentication suite |
| `npm run test:hardening` | Security hardening suite |

---

## Project Structure

```
├── backend/
│   ├── agents/          # Orchestrator, task router, workflows
│   ├── artifacts/       # Artifact generation (DOCX, PDF, XLSX, PPTX)
│   ├── config/          # App config, sovereign config
│   ├── controllers/     # Auth, chat, document, sovereign, analytics, eval, AI features
│   ├── middleware/       # Auth middleware, RBAC
│   ├── models/          # Model registry, classifier, router, capabilities, health
│   ├── monitor/         # System monitoring
│   ├── ocr/             # OCR service, PDF rasterizer
│   ├── providers/       # Cloud & local AI providers
│   ├── rag/             # Chunker, sovereign pipeline, fallback embedder, vector store
│   ├── routes/          # All API routes
│   ├── sandbox/         # Docker sandbox, code guard
│   ├── security/        # Audit, RBAC, policy, sovereign auth
│   ├── services/        # Agent, AI, retrieval, study, summary, voice, websearch, etc.
│   ├── storage/         # Sovereign SQLite DB
│   ├── tools/           # Tool registry + implementations
│   └── vision/          # Vision service
├── frontend/
│   ├── src/
│   │   ├── components/  # 3D scenes, auth, chat, layout, sovereign shell
│   │   ├── context/     # Auth & sovereign auth context
│   │   ├── hooks/       # Custom hooks
│   │   ├── i18n/        # Internationalization
│   │   ├── pages/       # All pages (dashboard, workbench, admin, sovereign)
│   │   └── services/    # API & auth services
│   └── public/          # Static assets, fonts
├── datasets/            # Simulated sample inputs (clearly labelled)
├── docs/                # Architecture, security, API, deployment, model cards
├── evaluation/          # Test suites, eval runners
├── infrastructure/      # Docker, nginx, air-gap bundling
├── scripts/             # Demo seed, demo run, asset generation
├── sovereign/           # Runtime data, audit logs, backups, artifacts
└── server.js            # Express entry point
```

---

## Workbench Pages

| Route | Description |
|-------|-------------|
| `/workbench` | Status, models, collections, documents |
| `/workbench/agent` | Task composer with approval gate, packet, trace |
| `/workbench/documents` | Upload + ingest documents |
| `/workbench/audit` | Verified hash-chain audit log |
| `/workbench/analytics` | Usage analytics & metrics |
| `/workbench/models` | Model registry & health |
| `/workbench/security` | Security policies & RBAC |
| `/workbench/settings` | System configuration |

---

## Sovereignty & Security

```
╔══════════════════════════════════════════════════════╗
║            SOVEREIGNTY / SECURITY PLANE             ║
║                                                      ║
║  LOCAL ONLY   │  EGRESS DENY  │  RBAC  │  LOGGING   ║
║  NO CLOUD     │  NETWORK NONE │  SANDBOX │  SECRETS  ║
╚══════════════════════════════════════════════════════╝
```

- **Local-Only Execution** — All AI inference runs on local Ollama; no cloud API calls
- **Egress Deny** — Outbound fetch/http/https/DNS blocked and logged in sovereign mode
- **RBAC** — Role-based access control (Admin, Inspector, Manager, Engineer)
- **Sandboxing** — Docker `--network none` for code execution; honest refusal when Docker absent
- **Audit Trail** — SHA-256 tamper-evident chain: user, action, timestamp, artifact hash
- **Backup & Retention** — WAL-safe VACUUM INTO backups, configurable retention policy
- **Secrets** — Separate JWT secrets for classic and sovereign domains; never reused

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19, Vite, React Router, Three.js (3D scenes) |
| Backend | Express 5, Node.js, JWT, Passport |
| Database | SQLite (Sovereign) / PostgreSQL (Classic) |
| AI Models | Ollama (Qwen3, Qwen3-VL, Nomic Embed) |
| OCR | Tesseract.js, pdfjs-dist |
| RAG | Hybrid BM25 + cosine similarity + MMR |
| Document Gen | docx, pdf-lib, pptxgenjs, xlsx |
| Security | bcrypt, rate limiting, RBAC, SHA-256 audit |
| Deployment | Local (Docker), air-gap bundling |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System design & component overview |
| [Security Model](docs/security.md) | Threat model & security controls |
| [Model Cards](docs/model-cards.md) | Qwen3 MVP stack specifications |
| [Database Schema](docs/db-schema.md) | Table definitions & relationships |
| [API Reference](docs/api.md) | Sovereign API endpoints |
| [Deployment](docs/deployment.md) | Air-gap bundling & deployment guide |
| [Limitations](docs/limitations.md) | Risk register & known limitations |
| [Test Report](docs/test-report.md) | Live suite results |
| [Phase 33 Report](docs/phase33-report.md) | Engineering progress report |
| [SIH26117 Design](docs/SIH26117-design.md) | Hackathon design document |
| [SIH26117 Compliance](docs/SIH26117-compliance.md) | Compliance checklist |
| [SIH26117 Final Report](docs/SIH26117-final-report.md) | Final submission report |

---

## Dataset

The `datasets/` folder holds **simulated** sample inputs for demonstration:

- `pump-p101-inspection-report.txt` — Simulated inspection report
- `pump-p101-scanned-tag.png` — Simulated scanned equipment tag
- `telemetry_B101_vibration.csv` — Simulated vibration telemetry data

> **Note:** All dataset files are clearly labelled **SIMULATED** for demonstration only. See `datasets/README.md`.

---

## License

ISC

---

Built for **SIH26117** — Smart India Hackathon 2026
