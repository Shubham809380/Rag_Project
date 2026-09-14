# Sovereign AI Workbench — Architecture

The workbench is a network-isolated, agentic, multimodal layer on top of the
existing web application. It can run with **zero cloud access**: SQLite storage,
a local hybrid vector store, offline rule-based routing, a tamper-evident audit
trail, and honest "no local model / no network" boundaries that never fabricate
deliverables.

## Runtime modes

| Mode | Egress | Storage | Provider | Purpose |
|------|--------|---------|----------|---------|
| `SOVEREIGN_MODE=local` (default) | denied by monitor guard | SQLite (`sovereign/data/sovereign.sqlite`) | local gateway (Ollama/vLLM) | network-isolated operation |
| `SOVEREIGN_MODE=online` | allowed | Postgres / Pinecone / Gemini | cloud | connected variant (kept for compat) |

> The governing rule: **local mode never falls back to the cloud, and never
> silently substitutes a "local unavailable" answer.** A human either approves,
> or the packet explains exactly why a model/capability is missing.

## Layering

```
 Frontend (React + Vite)                 /workbench, /workbench/agent, /workbench/documents, /workbench/audit
   │  axios  (role header x-sovereign-role in demo/dev)
 Controllers (sovereign.controller.js)   optionalAuth, RBAC checks, orchestration wiring
   │
 Agents/Ops
   Orchestrator  classify → gate → plan → execute (PRE_GEN / POST_GEN split)
   TaskRouter    routeWorkflow / taskGate / buildPlan
   Workflows     step runners (contextualize → gather_sources → … → finalize)
   ModelRouter   classify → select (registry) → enforce policy → invoke
   Monitor       egress guard (fetch/http/https/net/dns) + event log
   Sandbox       Docker one-shot, --network none, --mem/cpu caps, static guard
 Security
   RBAC      6 roles × permission levels × tool matrix
   Policy    riskFor(input, taskType, classification) → high/medium/low
   Audit     hash-chained JSONL + SQLite mirror
 Domain
   Storage   SovereignDB (SQLite: documents, chunks, vectors, tasks, artifacts, audit)
   RAG       localVectorStore = BM25 + cosine + MMR, access-scoped, citations
   Artifacts content-addressed docx/xlsx/pdf/pptx with provenance records
   Embedding fallback hash embeddings (384-d) when no local model exists
```

## Key decision points

1. **Single decision point for inference** — every generation goes through
   `ModelRouter.generate()`. Its `decide()` uses the offline classifier +
   registry (role/capability/profile) and applies policy. No code path calls a
   cloud model from local mode.
2. **Human-in-the-loop gating is up-front** — `taskGate()` computes the risk and
   approval requirement before any generation. High-risk tasks (e.g. approval
   notes, spend requests) are held `awaiting_approval` until an approver role
   approves via the API/UI.
3. **Honest packets over fabricated artifacts** — when generation is impossible
   the task ends with `status: "model_unavailable"` and a deterministic Workbench
   Packet (retrieved sources, calculations, comparisons, plan, trace). The agent
   never fills a deliverable with hallucinated local output.
4. **Access control is a data-plane concern** — access scope (`classification`)
   is embedded in every chunk; retrieval filters by role/level; granting is
   explicit (`documents_access` rows).
5. **Audit is a hash chain** — each event hashes `prev_hash + payload`; the
   controller exposes a verify endpoint; the read-only UI shows `INTACT`/broken.

## Tool surface (14)

| Tool | Capability | Min permission level |
|------|-----------|----------------------|
| search_knowledge_base, read_document, calculate, read_file | reasoning/KB | 0 |
| ocr_document, analyze_image, read_excel, create_word, create_pdf, create_pptx | vision/artifacts | 1 |
| execute_python, run_tests, write_excel, write_file | coding/workspace | 3 (engineer+) |

Roles: analyst/inspector (2), engineer/manager/reviewer (3), admin (4).

## Model stack (MVP, `SOVEREIGN_HW_PROFILE=small`)

Reasoning/agent → `qwen3:8b` · Vision/OCR → `qwen3-vl:8b` · Embeddings →
`nomic-embed-text`. Slots are model-agnostic (`MODEL_SLOTS`); availability is
reconciled from the local gateway at runtime. See `docs/model-cards.md`.

## Code map

```
backend/
  agents/        orchestrator, taskRouter, workflows
  artifacts/     generators + content-addressed store
  config/        sovereign.js (mode, provider, paths, approvals)
  models/        capabilities, classifier, registry, health, router
  monitor/       egress guard + metrics
  providers/     base + local (Ollama/vLLM) + cloud stubs
  rag/           sovereignPipeline, localVectorStore, fallbackEmbedder, chunker
  sandbox/       docker runner + static guard + run_tests.py
  security/      rbac, policy, audit
  storage/       sovereignDB (SQLite)
  tools/         registry + 14 implementations
  controllers/   sovereign.controller.js
  routes/        sovereign.routes.js
scripts/
  demo-seed.js   ingest sample SOP/policy/LOTO docs
  demo-run.js    deterministic end-to-end walkthrough
evaluation/
  run-eval.js    26 automated self-checks (npm run eval)
```