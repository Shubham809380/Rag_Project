import sovereign from '../config/sovereign.js';
import { getSovereignDB } from '../storage/sovereignDB.js';
import { modelRouter } from '../models/router.js';
import { normalizeUser, canApprove } from '../security/rbac.js';
import { policy } from '../security/policy.js';
import { auditService, CATEGORY } from '../security/audit.js';
import { monitor } from '../monitor/monitor.js';
import { sovereignTools } from '../tools/index.js';
import { routeWorkflow, taskGate, buildPlan, canRunWorkflowOnRole } from './taskRouter.js';
import { runStep } from './workflows.js';
import logger from '../utils/logger.js';

const LOG = 'Orchestrator';

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator — runs a sovereign agent task end-to-end.
//
// Honesty rules:
//  * If the task requires supervisory approval, we STOP and wait — we never
//    "pretend" the note is final while pending.
//  * Generation only runs through the ModelRouter → local provider. If no local
//    model is reachable we return a structured Workbench Packet (sources +
//    calculations + comparisons) and mark `model_unavailable` — we never fake
//    model output and we never fall back to a cloud model.
// ─────────────────────────────────────────────────────────────────────────────

export function workbenchPacket({ inbound, taskId, classification, risk, gate, ctx, gathered, calculations, comparisons, plan, trace, ocrExtracts = [], visionObservations = [] }) {
  const riskLevel = risk?.risk || risk?.level || 'low';
  return {
    packet: 'sovereign_workbench_v1',
    taskId,
    taskType: classification.taskType,
    workflow: routeWorkbook(classification.taskType),
    // Never write `undefined` into the risk field.
    risk: riskLevel,
    riskReason: risk?.reason || null,
    approvalStatus: gate?.requiresApproval ? 'pending' : 'not_required',
    inp: { subject: inbound.slice(0, 400) },
    // STRICT SEPARATION of evidence classes (hardening). Nothing below is
    // "verified" unless it is deterministic and source-grounded.
    verifiedFacts: {
      retrievedSources: (gathered || []).map(g => ({ documentId: g.documentId, document: g.document, page: g.page, section: g.section })),
      calculations: (calculations || []).map(c => ({ expression: c.expression, result: c.result })),
      policyClauses: (comparisons || []).map(c => ({ reference: c.reference, keyClauses: c.keyClauses || [] })),
    },
    aiInterpretation: null,
    aiObservations: {
      // OCR / vision output is an AI observation — never a verified conclusion.
      ocr: ocrExtracts.map(o => ({
        documentId: o.documentId, source: o.source, provider: o.provider,
        pages: (o.pages || []).map(p => p.text),
        warning: o.warning || null,
      })),
      vision: visionObservations.map(v => ({
        documentId: v.documentId, document: v.document, model: v.model,
        confidence: v.confidence, status: v.status,
        observations: v.observations, provenance: v.provenance,
      })),
      disclaimer: 'All OCR/vision content above is "AI observation only — not an engineering conclusion." Human verification is required before any safety-relevant use.',
    },
    uncertainties: (ctx?.ocrWarnings || []).map(w => String(w)).slice(0, 10),
    requiredHumanReview: gate?.requiresApproval || ctx?.ascertainedRisk === 'medium' || ctx?.ascertainedRisk === 'high',
    plan: plan?.steps || [],
    trace: trace || [],
    generated: false,
    message: 'No verified local model output was produced. The packet below is fully deterministic (retrieval + arithmetic + policy clauses only) and is safe to review as-is.',
  };
}

function routeWorkbook(t) { return routeWorkflow(t); }

export class Orchestrator {
  constructor({ db = null } = {}) {
    this.db = db || null;
  }

  _db() { return getSovereignDB(); }

  buildCtx({ user, sessionId, taskId, inbound, gathered, targets = [] }) {
    const tools = sovereignTools;
    const ctx = {
      user,
      sessionId,
      taskId,
      inbound,
      gathered,
      targets,
      toolDepth: 0,
      topK: sovereign.agent.retrievalK,
      toolCtx: () => ({ user, sessionId, taskId, audit: auditService(), policy: policy(), db: this._db(), monitor: monitor() }),
    };
    return ctx;
  }

  async start({ user, sessionId, input, classification = null, documentIds = [] }) {
    const db = this._db();
    const userN = normalizeUser(user);
    const router = modelRouter();

    const cls = classification || await router.classify({ question: input });
    const wf = routeWorkflow(cls.taskType);

    // ENFORCE role→workflow authorization server-side. Front-end menu hiding is
    // never the security boundary; this is. Unauthorized requests get a 403-style
    // result and NO task row is created.
    if (!canRunWorkflowOnRole(wf, userN.role)) {
      logger.warn(LOG, `Workflow denied by RBAC: role=${userN.role} workflow=${wf} (${cls.taskType})`);
      auditService().record({
        category: CATEGORY.SECURITY, action: 'task_denied_role', severity: 'warning',
        user, sessionId, details: { taskType: cls.taskType, workflow: wf, role: userN.role, input: String(input).slice(0, 200) },
      });
      return {
        status: 'forbidden', ok: false,
        code: 'SOVEREIGN_FORBIDDEN', reason: `Role "${userN.role}" is not authorized to run the "${cls.taskType}" (${wf}) workflow.`,
        role: userN.role, workflow: wf, taskId: null,
      };
    }

    const gate = taskGate({ input, classification: cls, user });
    const plan = buildPlan(cls.taskType, gate);
    // Explicit document targets persist with the plan so approval-resume and
    // re-execution carry the same document set.
    plan.documentIds = (documentIds || []).map(String).filter(Boolean).slice(0, 20);

    const task = db.createTask({
      userId: userN.id,
      userEmail: userN.email,
      title: `Sovereign task · ${cls.taskType}`,
      question: input,
      taskType: cls.taskType,
      workflow: wf,
      status: 'queued',
      approvalRisk: gate.risk.risk,
      approvalStatus: gate.requiresApproval ? 'pending' : 'not_required',
      plan,
    });

    db.recordUsage({ userId: userN.id, sessionId, taskId: task.id, action: 'task_start', details: { taskType: cls.taskType, workflow: wf, risk: gate.risk.risk } });
    auditService().record({ category: CATEGORY.AGENT, action: 'task_started', severity: 'info', user, sessionId, details: { taskId: task.id, taskType: cls.taskType, risk: gate.risk.risk } });

    if (gate.requiresApproval) {
      const upd = db.updateTask(task.id, {
        status: 'waiting_approval',
        approval_status: 'pending',
        approval_risk: gate.risk.risk,
        error: gate.risk.reason || `Approval required at ${gate.risk.risk} risk (${cls.taskType}).`,
      });
      logger.info(LOG, `Task ${task.id} waiting for supervisory approval (${gate.risk.risk}).`);
      return { status: 'awaiting_approval', taskId: task.id, gate, task: upd, packet: { note: 'Awaiting human approval before any generation. No AI output was produced.' } };
    }

    return this.execute({ taskId: task.id, input, cls, user, sessionId, documentIds: plan.documentIds });
  }

  async execute({ taskId, input, cls, user, sessionId, documentIds = [] }) {
    const db = this._db();
    // Prefer explicit re-supplied targets; otherwise fall back to what was stored
    // with the original plan (approval-resume path keeps the document set).
    const stored = db.getTask(taskId);
    const storedIds = Array.isArray(stored?.plan?.documentIds) ? stored.plan.documentIds : [];
    const docIds = documentIds?.length ? documentIds : storedIds;
    const targets = docIds.map(d => ({ documentId: String(d) }));
    const ctx = this.buildCtx({ user, sessionId, taskId, inbound: input, targets });
    const gate = taskGate({ input, classification: cls, user });
    ctx.ascertainedRisk = gate.risk?.risk || 'low';
    const plan = buildPlan(cls.taskType, gate);
    plan.documentIds = docIds;
    const PRE_GEN = new Set(['contextualize', 'gather_sources', 'assess_requirements', 'compare_policies', 'analyze', 'analyze_ocr', 'analyze_vision']);
    const POST_GEN = new Set(['draft_note', 'write_code', 'verify', 'report', 'draft_answer', 'finalize']);
    const trace = [];
    const gathered = [];
    let calculations = [];
    let comparisons = [];
    let ocrExtracts = [];
    let visionObservations = [];
    let answer = null;
    let artifact = null;
    let downloadPath = null;

    db.updateTask(taskId, { status: 'running', plan_json: plan });

    async function runPlanStep(step, stepIndex) {
      const start = Date.now();
      let stepResult = { note: step.note };
      try {
        switch (step.step) {
          case 'contextualize': stepResult = await runStep('contextualize', {}, ctx); break;
          case 'gather_sources':
            stepResult = await runStep('gather_sources', { question: input }, ctx);
            gathered.push(...(stepResult.sources || []));
            break;
          case 'assess_requirements':
            stepResult = await runStep('assess_requirements', { checks: parseExpressions(input) }, ctx);
            calculations = stepResult.calculations || [];
            break;
          case 'compare_policies':
            stepResult = await runStep('compare_policies', { references: gathered }, ctx);
            comparisons = stepResult.comparisons || [];
            break;
          case 'write_code':
            stepResult = await runStep('write_code', { code: answer?.content?.startsWith('```') ? extractCodeBlock(answer.content) : (extractCodeBlock(input) || answer?.content || ''), files: {} }, ctx);
            break;
          case 'verify':
            if (!answer) { stepResult = { skipped: 'no generated code' }; break; }
            stepResult = await runStep('verify', { code: extractCodeBlock(answer.content || '') || '', tests: '' }, ctx);
            break;
          case 'analyze': stepResult = await runStep('analyze', {}, ctx); break;
          case 'analyze_ocr':
            stepResult = await runStep('analyze_ocr', {}, ctx);
            ocrExtracts = stepResult.ocr || [];
            ctx.ocrWarnings = ocrExtracts.filter(o => o.lowQuality || o.blankScan).map(o => `OCR quality flag on ${o.source}:${o.lowQuality ? ' low quality' : ''}${o.blankScan ? ' blank scan' : ''}`);
            break;
          case 'analyze_vision': stepResult = await runStep('analyze_vision', {}, ctx); visionObservations = stepResult.observations || []; break;
          case 'draft_note':
            stepResult = await runStep('draft_note', {
              generated: answer?.content,
              gathered, calculations, comparisons,
              artifactName: `approval-note-${taskId.slice(0, 8)}.docx`,
              noteStructure: ({ calc }) => buildNoteStructure({ answer, gathered, calc, comparisons }),
              meta: { taskId, classification: cls.taskType, generatedBy: 'sovereign workbench', model: answer?.model || null, generatedAt: new Date().toISOString() },
            }, ctx);
            artifact = stepResult.artifact; downloadPath = stepResult.downloadPath;
            break;
          case 'report':
            stepResult = await runStep('report', {
              artifactName: `analysis-report-${taskId.slice(0, 8)}.pdf`,
              title: 'Analysis Report', meta: { taskId, taskType: cls.taskType },
              reportLines: buildReportLines({ answer, gathered, calculations, comparisons }),
            }, ctx);
            artifact = stepResult.artifact; downloadPath = stepResult.downloadPath;
            break;
          case 'draft_answer':
            stepResult = await runStep('draft_answer', { answer: answer?.content, model: answer?.model }, ctx);
            break;
          case 'finalize': stepResult = { persisted: true }; break;
          default: stepResult = { skipped: step.step };
        }
      } catch (err) {
        stepResult = { error: err.message, code: err.code || 'STEP_ERROR' };
      }
      trace.push({ stepIndex, step: step.step, tool: step.tool, elapsedMs: Date.now() - start, outcome: stepResult.error ? { error: stepResult.error } : { ok: true, keys: Object.keys(stepResult).slice(0, 6) } });
      return stepResult;
    }

    // 1) Deterministic pre-generation work (packet building) — always runs.
    for (const [i, step] of plan.steps.entries()) {
      if (PRE_GEN.has(step.step)) await runPlanStep(step, i);
    }

    // 2) Generation — ONLY through the local router. If no local model is
    //    reachable, we stop here (no deliverable artifacts are fabricated).
    const router = modelRouter();
    const gen = await router.generate({ question: input, taskType: cls.taskType });
    const generated = !!(gen.ok && gen.content);
    auditService().record({
      category: CATEGORY.AGENT,
      action: 'model_selected',
      severity: 'info',
      user,
      sessionId,
      details: { taskId, taskType: cls.taskType, model: gen.decision?.decisionModelId || null, status: gen.decision?.decisionStatus || null, reason: gen.decision?.reason || null, mode: sovereign.mode },
    });
    if (generated) {
      answer = gen;
      trace.push({ step: 'generate', note: 'local model', model: answer.model, reason: gen.decision?.reason || null });
      // 3) Post-generation steps (code execution, verification, deliverables).
      for (const [i, step] of plan.steps.entries()) {
        if (POST_GEN.has(step.step)) await runPlanStep(step, i);
      }
    } else {
      db.recordUsage({ userId: user?.id, sessionId, taskId, action: 'generation_unavailable', details: { reason: gen.message } });
      trace.push({ step: 'generate', note: 'model_unavailable', message: gen.message, reason: gen.decision?.reason || null });
    }

    // Deliverable only exists if we truly generated content — never fabricated.
    const finalTrace = trace;
    if (generated && artifact) {
      const status = 'completed';
      db.updateTask(taskId, { status, error: '', trace_json: finalTrace, sources_json: gathered, artifacts_json: [{ id: artifact.id, name: artifact.name, path: artifact.path }] });
      auditService().record({ category: CATEGORY.ARTIFACT, action: 'task_completed', severity: 'info', user, sessionId, details: { taskId, artifactId: artifact.id, generated: true, model: answer?.model || null } });
      return { status, taskId, task: db.getTask(taskId), generated: true, model: answer?.model || null, artifact: { id: artifact.id, name: artifact.name, downloadPath }, trace: finalTrace, packet: null };
    }

    if (generated && answer) {
      const status = 'completed';
      finalTrace.push({ step: 'answer', model: answer.model });
      db.updateTask(taskId, { status, error: '', trace_json: finalTrace, sources_json: gathered });
      return { status, taskId, task: db.getTask(taskId), generated: true, model: answer.model, answer: answer.content.slice(0, 200_000), trace: finalTrace, packet: null };
    }

    // Honest degraded outcome: full deterministic workbench packet, no artifact.
    const status = 'model_unavailable';
    const packet = workbenchPacket({ inbound: input, taskId, classification: cls, risk: gate.risk, gate, ctx, gathered, calculations, comparisons, plan, trace, ocrExtracts, visionObservations });
    db.updateTask(taskId, { status, error: gen.message, trace_json: finalTrace, sources_json: gathered, plan_json: plan });
    logger.warn(LOG, `Task ${taskId} completed as model_unavailable.`);
    return { status, taskId, task: db.getTask(taskId), generated: false, message: gen.message, packet };
  }

  async proceedAfterApproval({ taskId, approver, note = '', decision = 'approved' }) {
    const db = this._db();
    const task = db.getTask(taskId);
    if (!task) return { ok: false, reason: 'Task not found', statusCode: 404 };
    if (task.status !== 'waiting_approval') return { ok: false, reason: `Task is not waiting for approval (current status: ${task.status})`, statusCode: 409, currentStatus: task.status };
    const userN = normalizeUser(approver);
    // Approval is a supervisory act — the orchestrator enforces it, not just the
    // HTTP layer, so any caller of proceedAfterApproval is protected.
    if (!canApprove(userN)) return { ok: false, reason: 'User role cannot approve tasks', statusCode: 403 };
    if (!['approved', 'rejected'].includes(decision)) return { ok: false, reason: 'decision must be approved|rejected', statusCode: 400 };

    db.addApproval({ taskId, userId: userN.id, action: decision, note });
    auditService().record({ category: CATEGORY.SECURITY, action: 'task_approval', severity: 'info', user: approver, details: { taskId, decision, note } });

    if (decision === 'rejected') {
      db.updateTask(taskId, { status: 'rejected', approval_status: 'rejected', approver_user_id: userN.id, approval_note: note });
      return { ok: true, status: 'rejected', taskId };
    }
    db.updateTask(taskId, { approval_status: 'approved' });
    return { ok: true, ...(await this.execute({ taskId, input: task.question, cls: { taskType: task.taskType, modality: 'text' }, user: { id: task.userId, email: task.user_email, role: 'engineer' }, sessionId: null })) };
  }
}

let _orchestrator = null;
export const orchestrator = () => (_orchestrator || (_orchestrator = new Orchestrator()));
export default orchestrator;

// Deterministic helper: any `expr` lines or `calculate(...)` mention.
function parseExpressions(input) {
  const out = [];
  const lines = String(input || '').split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (/^[-+]?[0-9.()+\-*/^%\s]+$/.test(t) && /[0-9]/.test(t)) out.push(t);
    const m = t.match(/calculate\s*\(([^)]+)\)/i);
    if (m) out.push(m[1].trim());
  }
  return out.filter((v, i) => out.indexOf(v) === i).slice(0, 24);
}

function extractCodeBlock(input) {
  const m = String(input || '').match(/```(?:python)?\s*\n([\s\S]*?)```/);
  return m ? m[1] : String(input || '').slice(0, 4000);
}

// Deterministic structure builder for the approval-note deliverable (docx).
// Uses the verified model answer + computed values + retreived clauses.
function buildNoteStructure({ answer, gathered, calc, comparisons }) {
  const content = answer?.content || '';
  const sections = [];
  const paras = String(content).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paras.length) sections.push({ heading: 'Proposed approval', paragraphs: paras.slice(0, 12) });

  if (calc && calc.length) {
    sections.push({
      heading: 'Requirements check (computed, deterministic)',
      bullets: calc.map(c => `${c.expression} = ${c.result}`),
    });
  }
  if (comparisons && comparisons.length) {
    sections.push({
      heading: 'Governing clauses identified',
      paragraphs: comparisons.flatMap(c => (c.keyClauses || []).map(k => `${c.reference}: ${k}`)).slice(0, 20),
    });
  }
  if (gathered && gathered.length) {
    sections.push({
      heading: 'Sources',
      bullets: gathered.slice(0, 10).map(g => `${g.document}${g.page ? ` (p.${g.page})` : ''}${g.section ? ` — ${g.section}` : ''}`),
    });
  }
  if (!sections.length) sections.push({ heading: 'Note', paragraphs: ['(generated content unavailable)'] });
  return {
    sections,
    signature: {
      role: 'Authorized Supervisor',
      name: '_________________________',
      date: new Date().toISOString().split('T')[0],
    },
  };
}

// Deterministic structure builder for PDF analysis reports.
function buildReportLines({ answer, gathered, calculations, comparisons }) {
  const lines = [];
  if (answer?.content) lines.push(`SUMMARY: ${String(answer.content).replace(/[\r\n]+/g, ' ').slice(0, 4000)}`, '');
  if (calculations && calculations.length) {
    lines.push('REQUIREMENTS CHECK', ...calculations.map(c => `  ${c.expression} = ${c.result}`), '');
  }
  if (comparisons && comparisons.length) {
    lines.push('GOVERNING CLAUSES', ...comparisons.flatMap(c => (c.keyClauses || []).map(k => `  • ${c.reference}: ${k}`)));
  }
  if (gathered && gathered.length) {
    lines.push('SOURCES', ...gathered.slice(0, 10).map(g => `  • ${g.document}${g.page ? ` (p.${g.page})` : ''}`));
  }
  if (!lines.length) lines.push('(generated content unavailable)');
  return lines;
}