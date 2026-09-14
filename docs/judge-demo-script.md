# MRPL Sovereign AI — 7-Minute Judge Demo (SIH 26117)

Run: **`node server.js`** (port 5000). The server's startup banner prints live system
state. Keep this machine ON Ollama + Docker Desktop + logged in as the demo admin.

## Flow

1. **0:00 — Start screen**
   - Landing page states: local-first, egress guard active, honest `UNAVAILABLE` policy.
   - Tab: Workbench → **Judge Demo** (`/workbench/judge`).

2. **0:30 — Top verdicts show live**
   - Egress Guard Active (deny), Audit Chain Intact, Local-first Router.

3. **1:00 — Runtime Capabilities (read live from backend)**
   - Local Models: `6 installed / 4 routing slots` (3 unique routed; the 3 unused are
     labelled "Installed / Available but not currently routed") · OCR: `tesseract=true`
     · Docker: `AVAILABLE`.

4. **1:30 — Demo Control Panel → Run Full Demo**
   - Real checks, results stream in with logs (click each to expand):
     - `auth` PASS (demo admin) → `egress` PASS (real outbound fetch blocked)
     - `model` PASS (llama3.2 local inference, ~6 s)
     - `ocr` PASS (Tesseract transcribed the scanned P-101 tag, 95 chars, ~0.3 s)
     - `rag` PASS (grounded "LOTO isolation" on 8 local chunks with citations)
     - `sandbox` PASS (Docker `--network none`: Python ran, network refused)
     - `audit` PASS (SHA-256 chain, N events)
   - REST: `POST /api/sovereign/tests/<name>` (admin). GET `/availability`, `/status`.

5. **4:30 — Requirement Evidence table** (Reference the SIH 26117 map.)

6. **5:30 — Reproducible commands**
   ```
   npm test             · core 48/48
   npm run test:auth    · auth 21/21
   npm run test:security· RBAC/approval 9/9
   npm run test:egress  · egress blocked
   npm run test:tools   · tool sandbox + isolated Python 42, 8/8
   npm run test:scanned · scanned-PDF → OCR → RAG → grounded answer, 6/6
   npm run eval         · evidence 26/26
   ```

7. **6:30 — Honesty / production note**
   - App-layer egress guard is not an OS firewall: production requires firewall +
     physical isolation (credit to the badge text users see on every page).

## Credits the judge can inspect live
- Source: `backend/ocr/ocrService.js`, `backend/sandbox/docker.js`,
  `backend/models/router.js`, `backend/services/demoTests.js`,
  `frontend/src/pages/sovereign/SovereignJudge.jsx`.
- Live logs: expand any result card for the actual command output and latency.