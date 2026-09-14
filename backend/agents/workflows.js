// Workflow step runners. Each step receives (ctx) and returns a step result
// that is appended to the trace. Steps are tool-driven so every operation is
// policy-gated, time-limited and audited by the ToolRegistry.

import { getSovereignDB } from '../storage/sovereignDB.js';
import { modelRouter } from '../models/router.js';
import { policy } from '../security/policy.js';
import { auditService, CATEGORY } from '../security/audit.js';
import { sovereignTools } from '../tools/index.js';
import logger from '../utils/logger.js';

const LOG = 'Workflow';

const RUNNER = {
  context_of(note) { return { run: async () => ({ note }) }; },

  async contextualize(ctx) {
    return { note: 'Sovereign workbench: local + offline by design.', evidence: ctx.inbound };
  },

  async gather_sources(ctx) {
    const tr = await sovereignTools.execute('search_knowledge_base', { question: ctx.inbound, topK: ctx.topK || 8 }, ctx.toolCtx());
    return { sources: tr.result.citations, results: tr.result.results };
  },

  async assess_requirements(ctx) {
    const step = ctx.checks || [];
    const calc = [];
    for (const expr of step) {
      const r = await sovereignTools.execute('calculate', { expression: expr }, ctx.toolCtx());
      calc.push({ expression: expr, result: r.result.result });
    }
    return { calculations: calc };
  },

  async compare_policies(ctx) {
    const refs = ctx.references || [];
    const comparisons = [];
    for (const ref of refs.slice(0, 5)) {
      const r = await sovereignTools.execute('read_document', { documentId: ref.documentId, maxChunks: 12 }, ctx.toolCtx());
      comparisons.push({
        reference: r.result.title,
        keyClauses: r.result.chunks.map(c => c.text).filter(t => /limit|shall|must|not exceed|≤|>=|min|max|sole|single|urgent/i.test(t)).slice(0, 6),
      });
    }
    return { comparisons };
  },

  async write_code(ctx) {
    const r = await sovereignTools.execute('execute_python', { code: ctx.code, files: ctx.files }, ctx.toolCtx());
    return { execution: { stdout: r.result.stdout, stderr: r.result.stderr, exitCode: r.result.exitCode } };
  },

  async verify(ctx) {
    const hasTests = String(ctx.tests || '').trim().length > 0;
    if (!hasTests) {
      // NEVER claim a result is verified when no test ran. At most we smoke-run
      // the code so the trace shows what actually executed.
      const smoke = await sovereignTools.execute('execute_python', { code: ctx.code, files: ctx.files }, ctx.toolCtx());
      return {
        tests: {
          ok: false,
          verified: false,
          reason: 'No assertion tests were provided — verification is impossible. Run completed as a smoke check only.',
          exitCode: smoke.result.exitCode,
          stdout: (smoke.result.stdout || '').slice(0, 4000),
          stderr: (smoke.result.stderr || '').slice(0, 2000),
        },
      };
    }
    const r = await sovereignTools.execute('run_tests', { code: ctx.code, tests: ctx.tests }, ctx.toolCtx());
    return { tests: r.result };
  },

  // Fixed: targets come from explicitly supplied documentIds OR from whatever
  // gather_sources actually retrieved — the old code ran with an empty target
  // list (a silent no-op for imported/scanned work).
  async analyze(ctx) {
    const targets = refineTargets(ctx.targets, ctx.gathered);
    const extracted = [];
    for (const target of targets) {
      const r = await sovereignTools.execute('read_document', { documentId: target.documentId, maxChunks: 60 }, ctx.toolCtx());
      extracted.push({ source: r.result.title, chunks: r.result.chunks.length, sample: r.result.chunks.slice(0, 3).map(c => c.text) });
    }
    return { extracted, analyzed: extracted.length };
  },

  // OCR-first analysis: runs local OCR on each target and returns the exact
  // extracted text so the orchestrator can present it verbatim (AI OCR
  // observation, never "verified" without human review).
  async analyze_ocr(ctx) {
    const targets = refineTargets(ctx.targets, ctx.gathered);
    const ocr = [];
    for (const target of targets) {
      const r = await sovereignTools.execute('ocr_document', { documentId: target.documentId }, ctx.toolCtx());
      ocr.push({
        documentId: target.documentId,
        source: r.result.docFilename || r.result.documentId || target.documentId,
        provider: r.result.provider,
        pages: (r.result.pages || []).map(p => ({ page: p.pageNumber, text: p.text })),
        blankScan: !!(r.result.detail && r.result.detail.blankScan),
        lowQuality: !!(r.result.detail && (r.result.detail.lowConfidence || r.result.detail.lowQuality)),
        warning: (r.result.detail && r.result.detail.warning) || null,
      });
    }
    return { ocr, analyzed: ocr.length };
  },

  async analyze_vision(ctx) {
    const targets = refineTargets(ctx.targets, ctx.gathered);
    const observations = [];
    for (const target of targets) {
      const r = await sovereignTools.execute('analyze_image', { documentId: target.documentId }, ctx.toolCtx());
      observations.push({
        documentId: target.documentId,
        document: r.result.document,
        model: r.result.model || null,
        confidence: r.result.confidence ?? null,
        status: 'AI OBSERVATION ONLY — not an engineering conclusion. Human verification required for safety-relevant use.',
        observations: r.result.observations || {},
        provenance: r.result.provenance || {},
      });
    }
    return { observations, analyzed: observations.length };
  },

  async draft_note(ctx) {
    const body = ctx.noteStructure ? ctx.noteStructure({ gathered: ctx.gathered, calc: ctx.calculations, comparisons: ctx.comparisons }) : null;
    const r = await sovereignTools.execute('create_word', { name: ctx.artifactName || 'approval-note.docx', title: ctx.title || 'Approval Note', meta: ctx.meta || {}, sections: body?.sections || [], signature: body?.signature }, ctx.toolCtx());
    return { artifact: r.result.artifact, downloadPath: r.result.downloadPath };
  },

  async report(ctx) {
    const lines = ctx.reportLines || [];
    const r = await sovereignTools.execute('create_pdf', { name: ctx.artifactName || 'analysis-report.pdf', title: ctx.title || 'Analysis Report', meta: ctx.meta || {}, lines }, ctx.toolCtx());
    return { artifact: r.result.artifact, downloadPath: r.result.downloadPath };
  },

  async draft_answer(ctx) {
    // Generation handled by orchestrator so the router decides model availability
    // honestly. This runner merely packages what the orchestrator produced.
    return { answer: ctx.answer, model: ctx.model };
  },

  async finalize(ctx) {
    return { persisted: true };
  },
};

export function runStep(name, load, ctx) {
  const fn = RUNNER[name];
  if (!fn) return { ok: false, reason: `No runner for step: ${name}` };
  return fn.call(null, { ...ctx, ...load });
}

// Merge explicit documentIds in with whatever gather_sources produced, so an
// OCR/Vision workflow never runs against an empty list.
function refineTargets(explicit, gathered) {
  const out = [];
  const seen = new Set();
  for (const t of explicit || []) {
    const id = t?.documentId || t;
    if (id && !seen.has(id)) { seen.add(id); out.push({ documentId: id }); }
  }
  for (const r of (gathered?.results || gathered?.sources || gathered || [])) {
    const id = r?.documentId || r?.id;
    if (id && !seen.has(id)) { seen.add(id); out.push({ documentId: id }); }
  }
  return out.slice(0, 8);
}

export default RUNNER;