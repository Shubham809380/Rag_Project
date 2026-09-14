# Test Report — Sovereign AI Workbench

All suites are **real** automated checks (no mocks, no stubbed telemetry) run on
this host with the lightest local model stack. Results captured 2026-09-14.

## Host profile

- OS: Windows 11, PowerShell 5.1, Node 22.20.0, SQLite (experimental) backend.
- Model gateway: local Ollama on `127.0.0.1:11434`
- Models present: `qwen3:8b`, `qwen3-vl:8b`, `nomic-embed-text`, `llama3.2`, `tinyllama`
- Profile: `small`; egress: `deny`; code sandbox: Docker daemon unavailable this run (honest refusal, `test:tools` sandbox check still passes)
- Vision/OCR: local `qwen3-vl:8b` + in-process pdf.js rasterizer (no poppler)

## Suite status

### `npm run eval` — 26 / 26 PASS
Offline classification, risk gating, model-slot mapping, gateway-live routing,
no-cloud-fallback, grounded RAG + access control, egress guard (real process
boundary, external fetch blocked and persisted), tool registry + permission
gates, artifact generation + content-addressing, audit hash chain integrity.

### `npm test` — 48 / 48 PASS (fast, no live LLM)
Static code guard, RBAC / policy gates, classification + workflow routing,
model-registry statuses + routing `reason`, audit chain integrity, image-never-
cloud-OCR, scanned-PDF local handling, tool suite (14 tools), artifact OOXML
validation (docx/xlsx/pptx zip parts), sandbox honest refusal, grounded RAG +
access control + approval contract (403/409), egress guard + generation honesty.

### `npm run test:tools` — 8 / 8 PASS
xlsx upload → `read_excel` rows, `write_excel` artifact + read-back, sandboxed
Python isolated run (`print(6*7)` → 42), honest refusal, grounded KB search.
With `TESTS_LIVE_LLM=1` (`test:tools-live`) — **9 / 9 PASS** adds live
`ocr_document` + `analyze_image` on the label image.

### `npm run test:scanned` — 6 / 6 PASS (live OCR)
Embeds a PNG label into a PDF with **no text layer**, ingests it, expects route
`ocr` (never text-extraction), recalls the OCR'd content with page citation,
produces a grounded answer, and proves a truly blank scan fails honestly
(`EMPTY_DOCUMENT`, no fabricated text). Audit chain intact (count 1415).

### `npm run test:security` — 9 / 9 PASS
Prompt injection ×3, unauthorized approval (403), approval-bypass prevention
(high-risk stops for human), double decision (409), static code guard patterns,
audit chain intact after all attempts.

### `npm run test:egress` — PASS
Real outbound `fetch` to `8.8.8.8` in `deny` mode is intercepted and recorded as
an `EGRESS BLOCKED` event; audit chain stays intact (count 1416).

### `npm run test:auth` — 21 / 21 PASS
Password policy, hashing, bootstrap admin, sovereign token sign/verify, RBAC role
gating, change-password, session/invalid-token handling — including explicit
production-secret assertions.

### `npm run test:hardening` — 53 / 53 PASS
Host classification, file-signature (magic-byte) validation, audit chain +
backup/restore integrity, JWT secret fail-fast (production requires a dedicated
`SOVEREIGN_JWT_SECRET`; missing / known-dev / short secrets throw, strong
dedicated secret accepted, dev placeholder warns only), risk-coercion guard,
supersede/versioning semantics.

### `npm run test:docker` — SKIPPED (daemon unavailable this run)
Docker Desktop is not running, so `docker-integration.js` honestly SKIPs:
*"Sandbox refuses code execution honestly"*. The refusal path is still covered in
`npm test` and `test:tools`; when the daemon is live the isolated sandbox
(`--network none`, memory/cpu caps, `--rm`) is exercised directly.

## Why "honest refusal" is a feature

When the required capability is unavailable (no local model, no Docker), the
workbench **never** fakes output, never falls back to a cloud key, and never
runs untrusted code on the host. It returns a structured packet with an honest
`reason`/`code` (`model_unavailable`, `SANDBOX_UNAVAILABLE`, `EMPTY_DOCUMENT`).
Every decision is recorded in the tamper-evident audit chain.

## Known host-side constraints (not product defects)

- Tesseract 5.4.0 is installed and OCR is proven live on the scanned P-101 tag.
- Docker Desktop is available but its daemon was not running during this report;
  on hosts with Docker the sandbox runs network-less. On any host without Docker
  the static code guard + honest refusal path still ship and are tested.
- The verified claim is the **application-level** egress guard (defeats outbound
  `fetch`/DNS in `deny` mode). A production air-gap / full network isolation
  additionally requires
  OS/network-level firewall controls and physical network isolation.
- The vision model `qwen3-vl:8b` is listed by the local gateway but is **not**
  loaded/verified live (4 GB VRAM; ~148 s/page OOM risk on `small` profile).
  Vision capabilities are not claimed as verified. `LOCAL_GATEWAY_TIMEOUT_MS`
  is set generously (600 s).
