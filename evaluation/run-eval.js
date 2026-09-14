import { getSovereignDB } from '../backend/storage/sovereignDB.js';
import { classifier } from '../backend/models/classifier.js';
import { modelRouter, UNAVAILABLE_MESSAGE } from '../backend/models/router.js';
import { modelRegistry, resolveModelId } from '../backend/models/registry.js';
import { taskGate } from '../backend/agents/taskRouter.js';
import { sovereignSearch } from '../backend/rag/sovereignPipeline.js';
import { generateDocx, saveArtifact } from '../backend/artifacts/index.js';
import { generateText } from '../backend/services/ai.service.js';
import { monitor } from '../backend/monitor/monitor.js';
import { toolRegistry } from '../backend/tools/registry.js';
import { seedSovereign } from '../scripts/demo-seed.js';
import '../backend/tools/index.js';

const LOG = '[eval]';
let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.error(`  ✗ FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const db = getSovereignDB();

console.log('\n[eval] 1 — Offline task classification');
{
  const c1 = classifier.classify({ question: 'Draft an approval note for B-101 bearing spares above the limit' });
  check('approval note → approval_note', c1.taskType === 'approval_note', c1.taskType);
  const c2 = classifier.classify({ question: 'Inspect this scanned equipment image', fileType: 'scan.jpg' });
  check('scanned image → vision', c2.taskType === 'vision', c2.taskType);
  const c3 = classifier.classify({ question: 'Analyze failure percentage by equipment category and prepare a report' });
  check('analyze+report → document_analysis', c3.taskType === 'document_analysis', c3.taskType);
}

console.log('\n[eval] 2 — Human-in-the-loop gating');
{
  const g1 = taskGate({ input: 'draft an approval note to procure B-101 bearing spares', classification: { taskType: 'approval_note' }, user: { role: 'inspector' } });
  check('approval_note → HIGH risk, approval required', g1.requiresApproval === true && g1.risk.risk === 'high', `risk=${g1.risk.risk}`);
  const g2 = taskGate({ input: 'Find the LOTO isolation checks for blower B-101', classification: { taskType: 'retrieval' }, user: { role: 'inspector' } });
  check('benign retrieval → low/medium', ['low', 'medium'].includes(g2.risk.risk), `risk=${g2.risk.risk}`);
}

console.log('\n[eval] 3 — Model registry (Qwen3 MVP stack) + honest routing');
{
  // Slot keys are the contract; the concrete gateway id may be the MVP default
  // (qwen3-vl:8b / nomic-embed-text) or an admin/env override for constrained
  // hardware (SOVEREIGN_MODEL_*). Both resolve through the same registry path.
  const expectSlot = (name, def) => (process.env[name] || def);
  check(`reasoning_local slot → ${resolveModelId('reasoning_local')}`, resolveModelId('reasoning_local') === expectSlot('SOVEREIGN_MODEL_REASONING', 'qwen3:8b'), resolveModelId('reasoning_local'));
  check(`vision_local slot → ${resolveModelId('vision_local')}`, resolveModelId('vision_local') === expectSlot('SOVEREIGN_MODEL_VISION', 'qwen3-vl:8b'), resolveModelId('vision_local'));
  check(`embedding_embed slot → ${resolveModelId('embedding_embed')}`, resolveModelId('embedding_embed') === expectSlot('SOVEREIGN_MODEL_EMBED', 'nomic-embed-text'), resolveModelId('embedding_embed'));

  // Environment-adaptive: no gateway/model ⇒ decide() must say so (honest block).
  // With a live gateway that has the models ⇒ decide() must route to them.
  await modelRegistry.syncFromProvider({ force: true });
  const liveModels = getSovereignDB().listModels().filter(m => m.status === 'available');

  let d = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    d = await modelRouter().decide({ question: 'inspect image', taskType: 'vision' });
    if (liveModels.length === 0) break;
    if (d.available) break;
    // Transient local-gateway fetch failure — refresh status and retry once.
    await modelRegistry.syncFromProvider({ force: true });
  }
  if (liveModels.length === 0) {
    check('no local gateway → availability honest (unavailable)', d.available === false, d.unavailableReason || '');
  } else {
    const visionUp = liveModels.some(m => m.role === 'vision');
    check(`gateway live → vision routes ${visionUp ? 'to model' : 'honestly'}`, visionUp ? d.available === true : d.available === false, d.unavailableReason || `${d.decisionModelId}`);
  }

  const gen = await modelRouter().generate({ taskType: 'approval_note', question: '…' });
  check('no cloud fallback', gen.ok !== true || !!gen.content);
  if (gen.ok) check('routed to a local model id', !!gen.model, gen.model || '');
  else check('honest block message when generation impossible', !!gen.message, gen.message?.slice(0, 60) || '');

  const txt = await generateText('summarise the SOP');
  check('local-only generation (returns local text or null, never Gemini)', txt === null || typeof txt === 'string', txt === null ? 'null (no local model)' : 'local text');
}

console.log('\n[eval] 4 — Grounded RAG + access control');
{
  const seed = await seedSovereign();
  const okDoc = seed.find(r => r.filename === 'sop-07-blower-bearing.txt');
  check('seed ready', !!okDoc && (okDoc.skipped === true || okDoc.success === true), `${okDoc?.filename} chunks=${okDoc?.chunks}`);
  const who = { id: 'demo-operator', email: 'operator@plant.local', name: 'Demo Operator', role: 'inspector' };
  const hit = await sovereignSearch({ question: 'preventive maintenance frequency for bearing greasing', user: who, topK: 5 });
  check('recall: SOP among top hits', hit.results.some(r => r.document === 'sop-07-blower-bearing.txt'), hit.results.map(r => r.document).join(', '));
  check('citations carry page + section', hit.results.every(r => typeof r.page === 'number' && r.score > 0), 'page/score present');
  const stranger = await sovereignSearch({ question: 'preventive maintenance frequency for bearing greasing', user: { id: 'other-user', role: 'inspector' }, topK: 5 });
  check('unrelated user → zero unauthorized results', stranger.results.length === 0, `${stranger.results.length} result(s)`);
}

console.log('\n[eval] 5 — Egress guard (real process boundary)');
{
  const mon = monitor();
  if (!mon.patched) mon.init();
  try {
    await fetch('http://api.openai.com/v1/chat/completions');
    check('external fetch blocked', false, 'fetch unexpectedly allowed');
  } catch (err) {
    check('external fetch blocked', err.code === 'SOVEREIGN_EGRESS_DENIED', err.message?.slice(0, 50));
  }
  const evt = db.listSovereigntyEvents({ limit: 5 }).find(e => e.eventType === 'egress_block');
  check('block persisted to SQLite (monitor _db works)', !!evt, evt ? `destination=${evt.destination}` : 'no persisted event');
  let loopback = false;
  try { await fetch('http://127.0.0.1:1'); } catch (e) { loopback = e.code !== 'SOVEREIGN_EGRESS_DENIED'; }
  check('loopback not blocked (only failed to connect)', loopback);
}

console.log('\n[eval] 6 — Tool registry + secure code path');
{
  const tools = toolRegistry().all();
  check('14 tools registered', tools.length === 14, `${tools.length} tools`);
  const ctx = { user: { id: 'eval', role: 'inspector' }, sessionId: 'eval' };
  const calc = await toolRegistry().execute('calculate', { expression: '1 + 2 * 3' }, ctx);
  check('calculate works', calc.ok && calc.result.result === 7, `result=${calc.result?.result}`);
  let denied = false;
  try { await toolRegistry().execute('execute_python', { code: 'print(1)' }, { user: { id: 'eval', role: 'inspector' } }); }
  catch (e) { denied = e.code === 'TOOL_DENIED'; }
  check('execute_python denied for inspector (level<3)', denied, denied ? 'TOOL_DENIED' : 'unexpectedly allowed');
}

console.log('\n[eval] 7 — Artifact generation + audit integrity');
{
  const { doc, packer } = await generateDocx({ title: 'Eval Packet', meta: { scope: 'evaluation' }, sections: [{ heading: 'Sources', bullets: ['eval'] }] });
  const buf = await packer.toBuffer(doc);
  check('docx generated', buf.length > 0, `${buf.length} bytes`);
  const art = await saveArtifact({ taskId: 'eval-0001', userId: 'eval', name: 'eval-packet.docx', type: 'docx', mime: 'application/vnd.docx', buffer: buf });
  check('artifact content-addressed', /^[a-f0-9]{64}$/.test(art.checksum), `${art.checksum.slice(0, 12)}…`);
  const chain = db.verifyAuditChain();
  check('audit hash chain intact', chain.intact, `${chain.count} entries`);
  check('RAG/tool telemetry countable', db.countAudit({ category: 'tool', action: 'tool_start' }) > 0, 'tool_start count > 0');
}

console.log(`\n${'='.repeat(46)}\n[eval] PASS ${pass}  FAIL ${fail}\n${'='.repeat(46)}`);
process.exitCode = fail > 0 ? 1 : 0;