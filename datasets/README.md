# datasets/ — SIMULATED sample data for SIH26117

Everything in this folder is **synthetic and explicitly labelled for
demonstration only**. It is NOT MRPL data and does not describe any real plant,
equipment, person, reading or incident. Using it keeps the demo fully off-cloud
and legally clean (per the official PS: *"sample scanned PDFs, sample P&IDs from
open datasets — no proprietary data required"*).

| File | What it is | Used by |
|---|---|---|
| `pump-p101-scanned-tag.png` | Synthetic "photograph" of an equipment tag (P-101, LOTO required, SOP-07 §4.2) rendered locally | OCR + vision demo (UC-2), flagship optional OCR step |
| `pump-p101-inspection-report.txt` | Simulated inspection report INSP-2026-0911-02 with findings + recommended actions | Ingested into the KB → RAG grounding for the flagship approval-note demo (UC-1) |
| `telemetry_B101_vibration.csv` | Simulated 5-day vibration/temperature trend for B-101 with a clear upward anomaly | Excel/telemetry analysis demo (UC-4) `npm run excel` |

Regenerate with `npm run assets` (idempotent; `--force` rebuilds). All files are
produced by `scripts/generate-demo-assets.js` with deterministic content.

> Labelling note: every human-facing deliverable produced from these files is
> marked "SIMULATED DATA / DEMO ONLY" in the agent prompt and docs, so a judge
> can never mistake sample output for a real refinery record.