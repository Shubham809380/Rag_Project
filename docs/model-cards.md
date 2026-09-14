# Model Cards — Sovereign Workbench (MVP)

Registry slot keys map to local gateway ids via `backend/models/registry.js`
`MODEL_SLOTS`. Availability is reconciled at runtime by `syncFromProvider()`
(calls reachable only on loopback). Nothing is hard-coded in business logic —
swap a slot's id or add roles without touching the agent/RAG layer.

## MVP stack (`SOVEREIGN_HW_PROFILE=small`)

### Reasoning / agent / document analysis
- Slot: `reasoning_local` → gateway id `qwen3:8b`
- Capabilities: text_generation, reasoning, structured_output, tool_calling
- Uses: chat, summarization, approval-note drafting, planning, tool selection
- Notes: also used for CODING in the MVP (no dedicated coder required).
  To upgrade later: set role slot `coding_local` to a coder (e.g. `qwen3-coder:30b-a3b`).

### Vision / OCR / engineering drawing inspection
- Slot: `vision_local` → gateway id `qwen3-vl:8b`
- Capabilities: text_generation, vision, reasoning
- Uses: scanned documents, photos, screenshots, P&ID/drawing visual assistance
- Guardrail: vision output is labeled `AI OBSERVATION / UNVERIFIED / HUMAN
  ENGINEERING REVIEW REQUIRED` — never a safety-certified conclusion.

### Embeddings
- Slot: `embedding_embed` → gateway id `nomic-embed-text`
- Capability: embedding
- Notes: used for hybrid (BM25 + cosine + MMR) retrieval. When unavailable, the
  deterministic fallback embedder (384-d hashed n-grams) keeps retrieval working
  and is clearly flagged as `fallback`.

## Larger profiles

| Profile | reasoning | coding | vision |
|---------|-----------|--------|--------|
| `small` | qwen3:8b | qwen3:8b (MVP) | qwen3-vl:8b |
| `mid`   | qwen3:14b | qwen3-coder:30b-a3b | qwen3-vl:32b |
| `large` | qwen3:32b | qwen3-coder:30b-a3b | qwen3-vl:32b |

## If a model is missing
- The gateway is queried only on loopback; missing ids ⇒ status `unavailable`.
- Generation returns an explicit capability error; the orchestrator emits
  `model_unavailable` with an honest packet (sources, calculations, plan).
- No cloud fallback is ever attempted.

## Runtime status semantics (registry)

Each model carries one of: `available | unavailable | degraded | error`.

- `available` — a live loopback check reported the id present.
- `error` — the loopback gateway fetch itself failed (no status known).
- `unavailable` — the id is known but not present on the gateway.
- `degraded` — a real invocation failed recently (`markModelFailure`, TTL 10 min);
  the router then avoids the model and reports the reason honestly.

`decide()` always populates a human-readable `reason`
(e.g. `Task 'vision' routed to local model "qwen3-vl:8b" (role=vision, status=available, profile=small)`)
and `unavailableReason` when it cannot route. The chosen model is recorded as a
`model_selected` audit event with `category=agent`.

## Adding new models
1. Serve via Ollama / vLLM on the configured `LOCAL_GATEWAY_BASE`.
2. Add/override a slot id in `MODEL_SLOTS` (or via the models admin) with the
   required capabilities and role.
3. `syncFromProvider()` flips it to `available`; the classifier → router path
   starts using it with zero agent changes.