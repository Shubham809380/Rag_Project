# datasets/ — SIMULATED sample data

Everything in this folder is **synthetic and explicitly labelled for
demonstration only**. It does not describe any real plant, equipment, person,
reading or incident. Using it keeps every example fully off-cloud ("sample
scanned PDFs and sample P&IDs from open datasets — no proprietary data
required").

| File | What it is | Used by |
|---|---|---|
| `pump-p101-scanned-tag.png` | Synthetic "photograph" of an equipment tag (P-101, LOTO required, SOP-07 §4.2) rendered locally | OCR + vision analysis (UC-2), optional OCR step in the flagship example run |
| `pump-p101-inspection-report.txt` | Simulated inspection report INSP-2026-0911-02 with findings + recommended actions | Ingested into the KB → RAG grounding for the flagship approval-note example (UC-1) |
| `telemetry_B101_vibration.csv` | Simulated 5-day vibration/temperature trend for B-101 with a clear upward anomaly | Excel/telemetry analysis example (UC-4) `npm run excel` |

Regenerate with `npm run assets` (idempotent; `--force` rebuilds). All files are
produced by `scripts/generate-demo-assets.js` with deterministic content.

> Labelling note: every human-facing deliverable produced from these files is
> marked "SIMULATED DATA / DEMO ONLY" in the agent prompt and docs, so sample
> output can never be mistaken for a real plant record.