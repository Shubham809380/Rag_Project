# Contributing

Thanks for contributing to the **Sovereign AI Workbench**.

The project's core value is *sovereignty*: local-only inference, application-layer
egress isolation, honest degradation, and a tamper-evident audit trail. Keep that
contract intact.

## Ground rules

- **No new cloud dependencies in sovereign mode.** All AI, embeddings, OCR and
  search must run against the local gateway (Ollama/vLLM) with zero cloud
  fallback. Feature work must degrade honestly (`model_unavailable`,
  `SANDBOX_UNAVAILABLE`, `EMPTY_DOCUMENT`) rather than silently substituting a
  cloud call.
- **No fabricated output.** Deliverables and answers must be grounded in retrieved
  sources and gated by human approval where risk demands it. Tests must keep
  asserting honest refusal paths.
- **No telemetry, no external network calls at runtime.** The egress guard
  (`backend/monitor/monitor.js`) patches fetch/http/https/net/dns; new code that
  makes outbound calls in `deny` mode will fail the egress checks by design.
- **Secrets never enter the repo.** Use environment variables, extend
  `.env.example` with placeholders, and never commit `.env`, keys, or tokens.
  The server's fail-fast secret checks (`backend/config/sovereign.js`) are part
  of the security contract — do not relax them.

## Development setup

```bash
npm install
cd frontend && npm install && cd ..
cp .env.example .env          # set JWT_SECRET / SOVEREIGN_JWT_SECRET
npm run seed                  # sample KB
npm start                     # http://localhost:5000
```

## Testing

All suites are real automated checks (no mocks, no stubbed telemetry):

| Command | Scope |
|---------|-------|
| `npm test` | 48 fast unit/integration checks (no live LLM) |
| `npm run eval` | 26 offline self-checks |
| `npm run test:auth` | 21 authentication tests |
| `npm run test:security` | 9 security tests (injection, approval, bypass) |
| `npm run test:hardening` | 52 hardening tests |
| `npm run test:tools` | 8 tool smoke tests (`TESTS_LIVE_LLM=1` for live vision) |
| `npm run test:scanned` | 6 scanned-document → OCR → RAG E2E checks |
| `npm run test:docker` | Docker sandbox integration |

Run the full set before submitting a change and report exact PASS counts.

## Documentation

- Update `README.md` and `docs/` when behavior, endpoints, env vars, or the
  architecture change.
- Keep the honest terminology: **network isolation / application-layer egress
  guard** (not "100% air-gapped") and **tamper-evident SHA-256 audit chain**
  (not "blockchain").
- If you change model defaults or hardware profiles, update `docs/model-cards.md`.

## Pull requests

1. Branch from `main`; keep changes focused and rebased.
2. Add a regression test for bug fixes and honest-failure checks for new features.
3. Update `.env.example` and docs for any new environment variable.
4. Run the test suites above; report PASS counts in the PR description.
5. Do not include runtime data (`sovereign/data`, audit logs, backups, artifacts)
   or generated samples in commits — they are git-ignored.

## Code of conduct

Be respectful, biased toward evidence, and honest about limitations. Never claim
verification that wasn't executed.