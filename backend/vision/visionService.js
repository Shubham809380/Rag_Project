import fs from 'fs';
import path from 'path';
import { modelRouter } from '../models/router.js';
import { ocrImage } from '../ocr/ocrService.js';
import logger from '../utils/logger.js';

const LOG = 'VisionService';

// ─────────────────────────────────────────────────────────────────────────────
// Vision — image understanding via a LOCAL multimodal model.
// Returns observations + confidence + provenance, NOT engineering conclusions.
//
// The multimodal model is tried when it is already resident (warm) so calls stay
// fast. When the model is not warm (a slow swap-in on constrained hardware) or
// the inference fails/times out, the service falls back to offline OCR (real
// text extraction) and labels the result `mode: ocr-fallback`. It NEVER invents
// content it did not actually read.
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are analysing an industrial image/drawing (e.g. P&ID, equipment photo, inspection image) as an AI OBSERVATION assistant.
Produce a structured JSON observation with EXACTLY these keys:
{
  "description": "concise objective visual description",
  "textFound": ["strings/text/labels you can read"],
  "tags": ["component tags or identifiers"],
  "lines": ["line/pipe labels or IDs if visible"],
  "relationships": ["hints about connections between the labelled elements, clearly marked as hints"],
  "uncertainties": ["anything unclear, occluded, or unreadable"],
  "warning": "ALWAYS: 'AI observation only — not an engineering conclusion. Requires human verification by a qualified engineer.'"
}
Be conservative. Do not invent numbers, tags or connections that are not visibly present. If the image is unreadable, set description accordingly and list tagging failures.`;

export const VISION_NOT_AVAILABLE = 'Local multimodal vision capability is not available. This task requires a local vision model on the gateway.';

// Allow the multimodal attempt on a warm model; hard-cap the wait so a slow
// swap-in never blocks the demo (the OCR fallback then takes over).
const VISION_LLM_TIMEOUT_MS = 45_000;

function observationsFromFallback(ocrText) {
  const lines = String(ocrText || '').split('\n').map(s => s.trim()).filter(Boolean);
  return {
    description: lines.length
      ? 'OCR read the following text from the image. Visual layout and relationships were not assessed (multimodal model unavailable).'
      : 'No readable text was detected by offline OCR.',
    textFound: lines,
    tags: lines.filter(l => /\b[A-Z]{2,}[-\w]*[\d-]+\b|[A-Z]{2,3}-\d{2,4}\b/.test(l)),
    lines: [],
    relationships: [],
    uncertainties: lines.length
      ? ['Text extracted by offline OCR only — visual context and drawing relationships are not verified.']
      : ['No readable text detected by OCR.'],
    warning: 'AI observation only — not an engineering conclusion. Requires human verification by a qualified engineer.',
  };
}

export async function analyzeImage({ filePath, fileType, prompt, } = {}) {
  const router = modelRouter();
  const decision = await router.decide({ taskType: 'vision', images: [1] });

  if (decision.available && decision.decisionModelId) {
    let warm = false;
    try { warm = await router.provider.isWarm(decision.decisionModelId); }
    catch { warm = true; }
    if (warm) {
      const bytes = fs.readFileSync(filePath);
      const ext = path.extname(filePath || '').toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.bmp' ? 'image/bmp' : ext === '.tif' || ext === '.tiff' ? 'image/tiff' : 'image/jpeg';
      const imageData = `data:${mime};base64,${bytes.toString('base64')}`;
      const userPrompt = `${prompt ? `${prompt}\n\n` : ''}${ANALYSIS_PROMPT}`;

      let result;
      try {
        result = await Promise.race([
          router.generate({
            question: userPrompt,
            taskType: 'vision',
            images: [imageData],
            temperature: 0.1,
            think: false, // skip chain-of-thought: observations only, much faster
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`multimodal inference timed out after ${VISION_LLM_TIMEOUT_MS}ms`)), VISION_LLM_TIMEOUT_MS)),
        ]);
      } catch (err) {
        logger.warn(LOG, 'Multimodal inference failed; falling back to OCR', { error: err.message });
      }

      if (result?.ok && result.content) {
        const text = result.content;
        let json = null;
        try {
          const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          json = JSON.parse((fenced ? fenced[1] : text).trim());
        } catch {
          json = { description: text, textFound: [], tags: [], lines: [], relationships: [], uncertainties: ['Could not parse structured output'], warning: 'AI observation only — not an engineering conclusion.' };
        }
        return {
          ok: true,
          mode: 'vision-llm',
          decision,
          observations: json,
          model: result.model,
          provenance: {
            sourceImage: filePath ? path.basename(filePath) : 'inline',
            fileType: fileType || mime,
            timestamp: new Date().toISOString(),
          },
          confidence: 'AI observation — requires human verification',
        };
      }
    }
  }

  // Honest offline fallback when the multimodal model is not warm / usable.
  const ocr = await ocrImage(filePath, fileType);
  if (ocr.ok) {
    const text = (ocr.pages || []).map(p => p.text || '').join('\n').trim();
    return {
      ok: true,
      mode: 'ocr-fallback',
      decision,
      reason: decision.available
        ? `Multimodal model was not ready; used offline OCR (${ocr.provider}) instead.`
        : (decision.unavailableReason || VISION_NOT_AVAILABLE),
      observations: observationsFromFallback(text),
      model: ocr.provider,
      provenance: {
        sourceImage: filePath ? path.basename(filePath) : 'inline',
        fileType: fileType || 'image',
        timestamp: new Date().toISOString(),
      },
      confidence: 'Offline OCR — requires human verification',
    };
  }

  return { ok: false, reason: decision.unavailableReason || VISION_NOT_AVAILABLE, decision };
}