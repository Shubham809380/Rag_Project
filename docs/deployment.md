# Deployment (air-gapped / on-prem)

## Requirements

- Node.js ≥ 20 (ESM project). Verified on Node 22 with `node:sqlite`.
- Docker Engine (for sandboxed Python). The app degrades honestly when absent.
- Optional local model gateway matching the configured `SOVEREIGN_GATEWAY_SOURCE`:
  - Ollama (`http://localhost:11434/v1`, OpenAI-compatible by default)
  - vLLM (`http://localhost:8000/v1`)
- Disk: sovereign data lives under `sovereign/` (sqlite + uploads + artifacts).

## Bundling an offline image

1. On a connected machine: `npm install` at the repo root for the backend deps.
2. Pull the container images and model weights you need, e.g.:
   ```
   docker pull node:22-slim
   docker pull python:3.12-slim
   # on the gateway host (air-gapped target): `ollama pull qwen3:8b qwen3-vl:8b nomic-embed-text`
   #   (larger profiles: qwen3:14b / qwen3:32b / qwen3-coder:30b-a3b / qwen3-vl:32b)
   docker image save node:22-slim python:3.12-slim > /offline/images.tar
   ```
3. Copy the repo (including `node_modules`), `images.tar`, and the model weights
   to the air-gapped host. `infrastructure/airgap/airgap-bundle.ps1` produces a
   ready-to-copy bundle automatically.
4. Load the images (`docker image load < images.tar`) and place the models in the
   gateway's model directory.

## Start

```bash
# 1) env
cp .env.example .env          # keep SOVEREIGN_MODE=local (default), SOVEREIGN_HW_PROFILE=small
# 2) seed sample KB (optional)
npm run seed
# 3) verify the deterministic walkthrough
npm run demo                  # seed → classify → gate → retrieval → packet → artifact → audit
npm run eval                  # 26 automated self-checks (routing, gating, RAG, egress, tools, artifacts, audit)
npm test                      # 48 fast unit/integration checks
npm run test:scanned          # flagship scanned-PDF → local OCR → RAG (live vision)
npm run test:security         # prompt injection ×3, unauthorized approval, bypass, double decision
# 4) run
npm start                     # server on PORT (4877)
```

## Containerised deployment (compose)

`infrastructure/docker-compose.yml` + `infrastructure/docker/Dockerfile` provide an
air-gapped two-service stack:

- `ollama` — model gateway on the internal bridge (models pre-pulled offline).
- `workbench` — node:22-slim runtime image (`node server.js`), `SOVEREIGN_EGRESS=deny`,
  non-root user, `HEALTHCHECK` on `/health`, sovereign data on a named volume.

The app builds fine on Windows; the container image targets linux/amd64 and needs
`npm rebuild @napi-rs/canvas pdfjs-dist` for the linux native binaries (handled in
the Dockerfile with a graceful `|| true`). The code sandbox is left disabled
(`SOVEREIGN_SANDBOX=false`) in compose by default; enable it only when a docker
CLI is installed inside the workbench image.

Frontend (separate build): `cd frontend && npm install && npm run build`, serve
`frontend/dist` from nginx. Proxy `/api` to the backend.

## Open the UI

- `/workbench` — status, models, availability, collections, documents
- `/workbench/agent` — task composer with the approval gate + packet + trace
- `/workbench/documents` — upload (keeps a durable source copy) + classification
- `/workbench/audit` — hash-chained audit log

## Operator notes

- The egress guard logs every denied DNS/connect attempt to the audit trail
  (`network` category). In any mode other than strict air-gap, set
  `SOVEREIGN_MODE=online` (or `SOVEREIGN_UNSAFE_MODE=1` **development only**).
- Auto DB migration against Postgres/Neon is attempted and fails gracefully when
  the host is air-gapped; SQLite is the offline source of truth.
- Rotate `JWT_SECRET`; in production replace the demo role header with real auth.