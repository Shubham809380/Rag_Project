# SIH 26117 — Compliance Mapping (Honest Status)

Practical AI Platform for Industrial Inspection & Document Analysis.
Every state below is read live from the running system (`/api/sovereign/status`,
Judge page, test suites). Nothing is claimed that was not executed.

Legend:
- **VERIFIED** — executed and passing on this host (live run + automated suite).
- **PARTIAL** — feature present and functional, but host-constrained or not benchmarked to the full requirement.
- **DESIGNED ONLY** — implemented at design/extension level; requires external infra or a benchmark set to prove.
- **NOT IMPLEMENTED** — explicitly out of scope; stated rather than faked.

## Model inventory (live, 2026-09-13)

| Category | Count | Detail |
|---|---|---|
| Installed models (Ollama gateway) | 6 | `llama3.2` · `qwen3:8b` · `qwen3-vl:8b` · `qwen2.5-coder:3b` · `tinyllama` · `nomic-embed-text` |
| Configured routing slots (`small` profile) | 4 | `reasoning→llama3.2` · `coding→llama3.2` · `vision→qwen3-vl:8b` · `embedding→nomic-embed-text` |
| Installed models that are routed | 3 | `llama3.2` (shared by reasoning + coding) · `qwen3-vl:8b` · `nomic-embed-text` |
| Installed / available, **not** currently routed | 3 | `qwen3:8b` · `qwen2.5-coder:3b` · `tinyllama` |

Because multiple slots may reuse one installed model (reasoning + coding both use
`llama3.2`), **slot count (4) ≠ unique routed models (3) ≠ installed models (6)**.
Unused models are labelled "Installed / Available but not currently routed" in the UI,
never presented as slot capacity.

## Requirements from the problem statement

These are the **18 mapped SIH 26117 requirement/evidence items** used by this
submission — the problem-statement capability set analysed into concrete,
verifiable rows. They are not an official numbered list from the statement.

| # | Requirement (PS 26117) | Status | Evidence |
|---|------------------------|--------|----------|
| 1 | Working local deployment on mid-range GPU (no cloud dependency) | VERIFIED | Runs fully on RTX 2050 4 GB; router mode `local`; real llama3.2 generation 6.1 s; zero external-API calls |
| 2 | Multiple open-weight models with automatic task-based selection (≥ 2 task types) | VERIFIED | 6 models, 4 routed slots; router logs `TASK CLASSIFICATION` per decision (task→model→runtime→network origin); reasoning/coding/vision/embedding routed automatically |
| 3 | End-to-end agentic task (image scan → inspection → report/approval in Word) | VERIFIED | `docs/judge-demo-script.md` live run: scanned P-101 → OCR → RAG → agent → approval gate → DOCX artifact → audit chain |
| 4 | Coding task executed in an isolated sandbox | VERIFIED | Docker container (no network, 512 MB, 1 CPU); `print(6*7)=42` live; blocked `requests.get` live; `npm run test:tools` 8/8 |
| 5 | Multimodal: scanned-image/engineering-drawing understanding | VERIFIED | Tesseract 5.4.0 OCR (`PUMP P-101 / LOTO REQUIRED`) + qwen3-vl:8b vision on tag; `npm run test:scanned` 6/6 |
| 6 | Visible proof of zero external calls / sovereignty monitor | VERIFIED | Egress mode `deny`; real outbound `fetch` blocked; `/workbench/sovereignty` network monitor; per-call audit events |
| 7 | On-prem knowledge-base connector (SOPs, manuals, correspondence) | VERIFIED | Upload → durable copy → chunk → BM25 + `nomic-embed-text` (768-d) → grounded answer with citations (RAG live 1.0 s, 8 chunks) |
| 8 | Real deliverables (Word/Excel/PPT/PDF/files/code), not chat text | VERIFIED | OOXML structural checks on generated artifacts; `write_excel`, `write_file`, DOCX report pipeline exercised in `npm test` + approval E2E |
| 9 | Statistical & analytical analysis | PARTIAL | `read_excel` (formula results), `write_excel`, sandboxed Python live; model-driven statistical reasoning on large datasets not benchmarked |
| 10 | Multilingual support | PARTIAL | i18n UI framework; OCR language packs configurable via `TESS_LANGS`; regional-language inference output not independently verified |
| 11 | Security & access control (login, RBAC, data protection) | VERIFIED | `test:auth` 21/21, `test:security` 9/9; server-side 403 on role bypass; ownership scoping on docs/tasks/artifacts; documents 403 unless granted |
| 12 | Honesty under failure (no fabrication, no cloud fallback) | VERIFIED | Gateway-down returns `MODEL_UNAVAILABLE` (proved against unreachable gateway); `SANDBOX_UNAVAILABLE` / `OCR_ENGINE_UNAVAILABLE` / `EMPTY_DOCUMENT` tested; `npm run eval` includes no-fabrication checks |
| 13 | Human-in-the-loop approval for outputs | VERIFIED | Approval workflow gates high/medium risk; manager approve / inspector 403 verified |
| 14 | Tamper-evident audit (blockchain-based evidence) | PARTIAL — SHA-256 chain **VERIFIED**; blockchain **NOT IMPLEMENTED** | Append-only SHA-256 hash-linked log, chain integrity verified over live events; anchoring to a real distributed ledger is documented as a future/deployment extension and is not claimed |
| 15 | No-breakdown operation / failing without loss | VERIFIED for fail-closed degradation | Honest degrades on missing host services are tested (model/OCR/sandbox); no invisible fallback path exists. Data-loss guarantees additionally require the recovery drill below |
| 16 | Fault tolerance & data recovery | DESIGNED ONLY | SQLite WAL + retention pruning + artifact copies designed; no restore/failover drill executed on this host |
| 17 | Independent classification without a training dataset | DESIGNED ONLY | Rule/role/zero-shot classification + configurable skills implemented; no independent benchmark set supplied to prove accuracy |
| 18 | Plugin integration (upload / view / document handling) | VERIFIED | Multipart upload → sovereign copy → OCR/RAG pipeline; REST + UI verified |

**Status rollup (18 rows, computed; row 14 counts as PARTIAL):**

| TOTAL | VERIFIED | PARTIAL | DESIGNED ONLY | NOT IMPLEMENTED |
|---|---|---|---|---|
| **18** | **13** | **3** (`#9` stats · `#10` multilingual · `#14` tamper-evident audit) | **2** (`#16` fault tolerance · `#17` classification) | **0** (standalone) |

Row `#14` is `PARTIAL`: the SHA-256 tamper-evidence hash chain is implemented and
verified; the blockchain mechanism named inside that requirement is explicitly
**NOT IMPLEMENTED** and disclosed as a deployment extension — it is not claimed.
TOTAL = VERIFIED + PARTIAL + DESIGNED ONLY + NOT IMPLEMENTED = 18. ✓

## Security wording (must be stated precisely)

- **Verified control**: "the application enforces sovereign-mode outbound request
  denial at the application layer" — egress mode `deny` blocks real outbound requests
  and logs each attempt (application-level control).
- **Production target**: "a production air-gap additionally requires OS/network-level
  firewall controls and physical network isolation" — this workbench implements and
  demonstrates the app-layer portion, and does **not** claim to enforce a physical
  air-gap on the host.

## Host capabilities (this machine)

| OS | GPU | Ollama | Docker | OCR | Embeddings | Storage |
|---|---|---|---|---|---|---|
| Windows 11 | RTX 2050 4 GB | 0.34.0 (6 models) | Daemon UP (network-none image) | Tesseract 5.4.0 | nomic-embed-text 768-d | SQLite (local) |

Not fabricated — 4 GB VRAM means 8B vision runs CPU-swapped and slow (~2.5 min/query);
this is exactly what the `small` hardware profile surfaces honestly.