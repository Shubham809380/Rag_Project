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
| Egress guard | Interception covers fetch/http/https/net/dns in the Node process; it cannot police other binaries the host runs. | Enforce at the host/network layer for full isolation (no default route). |
| RBAC | Demo identity uses an `x-sovereign-role` header when no JWT is present. | Production deployments replace with real auth; never enable SOVEREIGN_DEMO_USER in prod. |
| Audit | Details are summarized (no raw doc contents logged by design); JSONL mirror is file-based. | Hash chain detects tampering; retention policy configurable. |
| Multi-user skew | Retrieval is scoped to ownership/grants per user. | Admin/ownership model exists; classification labels surfaced. |

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | Prompt injection from document content steering the agent | Medium | High | Docs are DATA; SYSTEM/USER/CONTENT separation; tools gated by permission+policy; egress deny. |
| R2 | Unauthorized financial/procurement action | Low | High | approval_note/procurement_note always HIGH ⇒ mandatory human approval. |
| R3 | Confidential data exposure | Low | High | Network isolation; egress deny; RAG access-scoped; audit of every retrieval + tool. |
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
- **2026-09-06 — live stack (Windows, CPU or low-VRAM hybrid, Ollama)**:
  - `qwen3:8b`: real grounded generation (approval-note workflow: class → gate →
    manager approval → generation → DOCX artifact, 10 KB, content references
    SOP-07 LOTO 3.2 / inspection 4.1).
  - `qwen3-vl:8b`: real vision/OCR (synthetic industrial label transcribed
    verbatim: "PUMP P-101 LOTO REQUIRED / SOP-07 Section 3.2"). Vision is
    architected around the local Qwen3-VL runtime.
- **2026-09-14 — live stack (this reference host)**:
  - Scanned-document E2E **6/6 PASS** (`npm run test:scanned`): scanned label
    PNG → local OCR → RAG ranking #1–2 with correct citations → grounded answer
    citing page/positions; per-document diversity cap + BM25 saturation tuning.
  - Live agentic generation verified with `llama3.2` (lightweight): OCR task →
    `awaiting_approval` (risk=medium) → approved → `generated:true` grounded,
    cited answer.
  - Docker sandbox exercised live: isolated run `print(6*7)` → 42, outbound
    refused (`test:docker` 3/3, `test:tools` 8/8).
  - **Vision honesty note:** on a ~15.6 GB RAM + 4 GB VRAM laptop, loading
    `qwen3-vl:8b` (≈6.1 GB) for inference trigger OOM and crashed the gateway;
    the model is registered/available in the model registry, but **reliable 8B
    vision inference requires appropriate memory/model configuration or
    higher-memory infrastructure**. Vision is NOT claimed as fully verified on
    this reference host; the OCR pipeline falls back to tesseract/pdf.js paths
    where verified.