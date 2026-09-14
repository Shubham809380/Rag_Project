import sovereign from '../config/sovereign.js';
import { policy } from '../security/policy.js';
import { normalizeUser } from '../security/rbac.js';

// ─────────────────────────────────────────────────────────────────────────────
// TaskRouter — converts a classification + user into a concrete workflow plan.
// Workflows come from workflows.js; every plan carries its gates up-front so
// the controller can ask a human before any generation runs.
// ─────────────────────────────────────────────────────────────────────────────

const WORKFLOW_BY_TASK = {
  approval_note: 'approval_note',
  procurement_note: 'approval_note',
  document_analysis: 'document_analysis',
  analysis: 'document_analysis',
  coding: 'coding',
  code_sketch: 'coding',
  kb_question: 'kb_question',
  retrieval: 'kb_question',
  ocr: 'ocr',
  vision: 'vision',
  chat: 'kb_question',
  default: 'kb_question',
};

// Minimum RBAC level required to RUN a workflow. Computing code / writing
// binary artifacts is a privileged activity; reading and analysis are open to
// all authenticated roles. (PERM: 0=PUBLIC 1=RESTRICTED 2=PRIVILEGED 3=OWNER 4=ADMIN)
export const WORKFLOW_MIN_LEVEL = {
  coding: 2,
  document_analysis: 1,
  kb_question: 1,
  ocr: 1,
  vision: 1,
  approval_note: 1, // the human-approval gate protects finalization
};

export function routeWorkflow(taskType) {
  return WORKFLOW_BY_TASK[taskType] || WORKFLOW_BY_TASK.default;
}

// Server-side authority check: may this role RUN the workflow at all?
// This backs `gate.roleCheck.allowed` and orchestrator.start() enforcement —
// front-end menu hiding is never the security boundary.
export function canRunWorkflowOnRole(workflow, role) {
  const userN = normalizeUser({ role });
  return userN.level >= (WORKFLOW_MIN_LEVEL[workflow] ?? 1);
}

// Compute the approval gate for a task up-front (before generation).
export function taskGate({ input, classification, user }) {
  const userN = normalizeUser(user);
  const risk = policy().riskFor({ input, taskType: classification?.taskType || '', classification: classification?.classification || 'INTERNAL', domain: '' });
  const workflow = routeWorkflow(classification?.taskType || '');
  const minLevel = WORKFLOW_MIN_LEVEL[workflow] ?? 1;
  return {
    risk,
    requiresApproval: risk.risk === 'high' || (sovereign.approvals.requireForMedium && risk.risk === 'medium'),
    roleCheck: { allowed: canRunWorkflowOnRole(workflow, userN.role), minLevel, role: userN.role, workflow },
    userRole: userN.role,
  };
}

export function buildPlan(taskType, gate) {
  const base = {
    taskType,
    workflow: routeWorkflow(taskType),
    gates: gate,
    steps: [],
  };
  switch (base.workflow) {
    case 'approval_note':
      base.steps = [
        { step: 'contextualize', tool: null, note: 'Sovereign context + policy grounding' },
        { step: 'gather_sources', tool: 'search_knowledge_base', note: 'Retrieve relevant collections/documents with access control' },
        { step: 'assess_requirements', tool: 'calculate', note: 'Deterministic computation of limits/quantities (no LLM)' },
        { step: 'compare_policies', tool: 'read_document', note: 'Compare against governing SOP/limits' },
        { step: 'draft_note', tool: 'create_word', note: 'Generate approval note deliverable' },
        { step: 'finalize', tool: null, note: 'Persist artifact + audit trace' },
      ];
      break;
    case 'coding':
      base.steps = [
        { step: 'contextualize', tool: null, note: 'Break down request into code + tests' },
        { step: 'gather_sources', tool: 'search_knowledge_base', note: 'Ground on project/institutional references if available' },
        { step: 'write_code', tool: 'execute_python', note: 'Generate and execute Python in one-shot sandbox' },
        { step: 'verify', tool: 'run_tests', note: 'Run assertion suite in sandbox' },
        { step: 'finalize', tool: null, note: 'Summarize result + persist trace' },
      ];
      break;
    case 'ocr':
      base.steps = [
        { step: 'contextualize', tool: null, note: 'Identify scanned documents to extract' },
        { step: 'gather_sources', tool: 'search_knowledge_base', note: 'Resolve stored documents (explicit documentIds preferred)' },
        { step: 'analyze_ocr', tool: 'ocr_document', note: 'Run local OCR per target, extract verbatim text' },
        { step: 'draft_answer', tool: null, note: 'Present extracted text + OCR quality warnings' },
        { step: 'finalize', tool: null, note: 'Persist trace + audit' },
      ];
      break;
    case 'vision':
      base.steps = [
        { step: 'contextualize', tool: null, note: 'Identify images/drawings to inspect' },
        { step: 'gather_sources', tool: 'search_knowledge_base', note: 'Resolve stored images (explicit documentIds preferred)' },
        { step: 'analyze_vision', tool: 'analyze_image', note: 'Local multimodal observation — AI observation only, never replaced by verified conclusion' },
        { step: 'draft_answer', tool: null, note: 'Package observations + uncertainties + confidence' },
        { step: 'finalize', tool: null, note: 'Persist trace + audit' },
      ];
      break;
    case 'document_analysis':
      base.steps = [
        { step: 'contextualize', tool: null, note: 'Identify document set + purpose' },
        { step: 'gather_sources', tool: 'search_knowledge_base', note: 'Retrieve underlying documents' },
        { step: 'analyze', tool: readExtractStep(), note: 'OCR/vision or text extraction as applicable' },
        { step: 'report', tool: 'create_pdf', note: 'Generate verified analysis report' },
        { step: 'finalize', tool: null, note: 'Persist artifact + audit trace' },
      ];
      break;
    default:
      base.steps = [
        { step: 'contextualize', tool: null, note: 'Frame the question' },
        { step: 'gather_sources', tool: 'search_knowledge_base', note: 'Retrieve grounded passages' },
        { step: 'draft_answer', tool: null, note: 'Generate grounded answer' },
        { step: 'finalize', tool: null, note: 'Persist trace' },
      ];
  }
  return base;
}

function readExtractStep() {
  return 'read_document';
}

export default buildPlan;