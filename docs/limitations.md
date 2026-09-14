# Limitations & Risk Register

Honest, current-state limitations. Nothing here claims "100% secure", "fully
compliant", "hallucination-free" or "engineering-certified" — treat all AI output
as a draft requiring human validation.

## Limitations

| Area | Limitation | Mitigation in this workbench |
|------|-----------|-------------------------------|
| Generation quality | Small open-weight models (qwen3:8b) can hallucinate, drift, or produce non-deterministic wording. | Retrieval-first; citations; "AI OBSERVATION / UNVERIFIED" labels; human approval for high-impact tasks. |
| Embeddings | Fallback hashed embeddings (384-d) are low-fidelity versus a real embedding model. | nomic-embed-text preferred; flagged `fallback`; hybrid BM25 + cosine keeps keyword recall robust. |
| OCR/vision | Local OCR (tesseract/paddle) accuracy varies on degraded scans; VL outputs are observations, not measurements. | pre-checks, honest failure, no safety/engineering claims. |
| Sandbox | Docker sandbox refuses when no daemon; container escape risk is not zero. | `--network none`, CPU/mem caps, static guard, no host mounts/credentials. |
| Egress guard | Interception covers fetch/http/https/net/dns in the Node process; it cannot police other binaries the host runs. | Enforce at the host/network layer for true air-gap (no default route). |
| RBAC | Demo identity uses an `x-sovereign-role` header when no JWT is present. | Production deployments replace with real auth; never enable SOVEREIGN_DEMO_USER in prod. |
| Audit | Details are summarized (no raw doc contents logged by design); JSONL mirror is file-based. | Hash chain detects tampering; retention policy configurable. |
| Multi-user skew | Retrieval is scoped to ownership/grants per user. | Admin/ownership model exists; classification labels surfaced. |

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | Prompt injection from document content steering the agent | Medium | High | Docs are DATA; SYSTEM/USER/CONTENT separation; tools gated by permission+policy; egress deny. |
| R2 | Unauthorized financial/procurement action | Low | High | approval_note/procurement_note always HIGH ⇒ mandatory human approval. |
| R3 | Confidential data exposure | Low | High | Air-gap; egress deny; RAG access-scoped; audit of every retrieval + tool. |
| R4 | Rogue generated code | Medium | High | Static guard + Docker `--network none` sandbox; refusal when sandbox absent. |
| R5 | Audit tampering | Low | Medium | prev_hash chain + periodic verification; read-only UI shows INTACT/broken. |
| R6 | Model/date drift versus policies | Medium | Medium | Versioned SOP ingestion; citations; human review gate. |

## Verifiable claims (and only these)
- Designed to run without internet and with no cloud provider instantiated.
- Supports local RAG, OCR, vision, code sandbox, artifact generation, RBAC, audit.
- Demonstrates deterministic offline routing, gating and honest degradation.
- Designed to reduce hallucinated deliverables by gating generation behind
  availability and human approval.

## What an evaluation must check each release
`npm run eval` (26 checks): classifier mapping, risk gating, Qwen3 slot wiring,
honest generation block/no cloud fallback, RAG recall + access control, real
egress blocking + persistence, tool permission enforcement, artifact integrity,
audit chain integrity.

## Runtime verification log
- **2026-09-06 — live stack (Windows, CPU-only, Ollama 0.32.11)**
  - `qwen3:8b`: real grounded generation (approval-note workflow: class → gate →
    manager approval → generation → DOCX artifact, 10 KB, content references
    SOP-07 LOTO 3.2 / inspection 4.1).
  - `qwen3-vl:8b`: real vision/OCR (synthetic industrial label transcribed
    verbatim: "PUMP P-101 LOTO REQUIRED / SOP-07 Section 3.2").
  - `nomic-embed-text`: 768-d embeddings for ingest + query (docs re-indexed,
    `provider=embedding_embed`).
  - Audit hash chain INTACT, sovereignty events show `local_model`
    (127.0.0.1:11434) for every model call and `egress_block` for api.openai.com
    + Neon; e2e task = `completed` with downloadable artifact.
  - Not yet runtime-verified on this host: Docker sandbox execution (daemon
    absent → honest refusal), scanned-PDF OCR engine path, hardware-offline demo
    (this dev machine remained online).