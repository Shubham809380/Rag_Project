// A deterministic offline classifier. Rule-based (no model dependency) so that
// routing decisions are auditable, reproducible and work with air-gapped stock.
import { TASK_TYPES, MODALITIES } from './capabilities.js';

const PATTERNS = [
  { task: TASK_TYPES.APPROVAL_NOTE, weight: 4, tests: [/approval note|approval letter|issuance of approval|request for approval|note for approval|approval memo|for approval|approval is requested|seek(ing)? approval/i] },
  { task: TASK_TYPES.PROCUREMENT_NOTE, weight: 4, tests: [/procurement note|purchase order|vendor recommendation|sole source|single vendor|tender|bid evaluation|rate contract|indent\b|capital expenditure|pr\b|purchase request/i] },
  { task: TASK_TYPES.CODING, weight: 3, tests: [/code|debug|python|program|script|refactor|bug\b|exception|traceback|syntax|function\b|class\b|sql|regex|compile|docker|unit test|test case/i, /`[a-z_]+\(.*\)`/, /\.py\b|\.js\b|\.ts\b|\.java\b|\.c\b|\.cpp\b/] },
  { task: TASK_TYPES.MATH, weight: 2, tests: [/calculate|compute|sum\b|average|mean|percentage|percent|equation|formula|derivative|integral|divide|multiply|solve for|how many|total\b|convert/, /\d+\s*[-+*/^%()]\s*\d/, /\b(?:mean|median|std|variance|regression)\b/] },
  { task: TASK_TYPES.OCR, weight: 2, tests: [/ocr\b|opt ical character|extract text (from|of)|scanned|scan the|read the image text|transcribe/i] },
  { task: TASK_TYPES.VISION, weight: 2, tests: [/image|picture|photo|screenshot|drawing|p&id|pip and id|diagram|equipment (shown|in)|what is (shown|depicted|displayed)|identify (equipment|component|tag)|analyze (this|the) (image|drawing|diagram)/i] },
  { task: TASK_TYPES.ARTIFACT_GENERATION, weight: 2, tests: [/generate? (a|an) (word|docx|excel|xlsx|powerpoint|pptx|pdf|report|presentation)|create (a|an) (word|docx|excel|xlsx|ppt|pptx|pdf)|draft (a|an) (report|letter|note|approval)|produce (a|an)/i] },
  { task: TASK_TYPES.DOCUMENT_ANALYSIS, weight: 3, tests: [/analy{0,1}se|analy{0,1}ze|inspection report|findings|summari[sz]e|approval note|maintenance sop|standard operating|clauses?|contract|review (the|this) (report|document|pdf)|identify (the )?findings|recommendation/i] },
  { task: TASK_TYPES.RESEARCH, weight: 2, tests: [/research|investigate|compare and contrast|literature|deep dive|multiple sources|synthesize/i] },
  { task: TASK_TYPES.RETRIEVAL, weight: 1, tests: [/in (the |my )?(document|pdf|kb|knowledge base|file)|from (the |my )?(document|file|upload)|what does|where is|find (in|the)|search (the)? (document|kb|knowledge)/i] },
];

export class TaskClassifier {
  classify({ question = '', fileType = null, images = [], mode = 'auto' } = {}) {
    const q = String(question);
    let modality = MODALITIES.TEXT;
    if (images && images.length) modality = MODALITIES.IMAGE;
    else if (/\.(png|jpe?g|gif|bmp|tiff?)$/i.test(String(fileType))) modality = MODALITIES.IMAGE;
    else if (/(\.pdf|\.docx?|\.txt|\.md)$/i.test(String(fileType))) modality = MODALITIES.DOCUMENT;
    else if (/(\.xlsx?|\.csv)$/i.test(String(fileType))) modality = MODALITIES.SPREADSHEET;
    else if (/(\.py|\.js|\.ts|\.java|\.c|\.cpp)$/i.test(String(fileType))) modality = MODALITIES.CODE;

    if (modality === MODALITIES.IMAGE) {
      const visionHits = PATTERNS.find(p => p.task === TASK_TYPES.VISION).tests.some(t => t.test(q));
      const ocrHits = PATTERNS.find(p => p.task === TASK_TYPES.OCR).tests.some(t => t.test(q));
      if (ocrHits && !visionHits) return { taskType: TASK_TYPES.OCR, modality, reason: 'image modality + explicit OCR intent' };
    }

    // Explicit OCR/transcription intent always wins over generic document analysis.
    if (/\bocr\b|optical character/i.test(q)) {
      return { taskType: TASK_TYPES.OCR, modality, reason: 'explicit OCR intent' };
    }

    let best = { task: TASK_TYPES.CHAT, score: 0, reason: 'no strong signal — default chat' };
    for (const p of PATTERNS) {
      let hits = 0;
      for (const t of p.tests) if (t.test(q)) hits++;
      if (hits === 0) continue;
      const score = hits * p.weight;
      if (score > best.score) best = { task: p.task, score, reason: `${hits} pattern hit(s)` };
    }

    // Image modality wins unless a strong text intent overrides.
    if ((modality === MODALITIES.IMAGE || modality === MODALITIES.DOCUMENT) && best.score < 3) {
      if (modality === MODALITIES.IMAGE) return { taskType: TASK_TYPES.VISION, modality, reason: 'image attached without other strong intent' };
    }

    // Erred explicit mode
    if (mode === 'coding') best = { task: TASK_TYPES.CODING, score: 10, reason: 'explicit mode' };
    if (mode === 'vision') best = { task: TASK_TYPES.VISION, score: 10, reason: 'explicit mode' };
    if (mode === 'document') best = { task: TASK_TYPES.DOCUMENT_ANALYSIS, score: 10, reason: 'explicit mode' };
    if (mode === 'agent') best = { task: TASK_TYPES.AGENT, score: 10, reason: 'explicit mode' };

    return { taskType: best.task, modality, reason: best.reason };
  }
}

export const classifier = new TaskClassifier();