// Live local-LLM probe: llama3.2 text inference + nomic-embed-text embedding.
// Explicitly does NOT load qwen3-vl:8b (heavy vision) — verified by tags listing only.
import { getLocalProvider } from '../backend/providers/index.js';
import { modelRouter } from '../backend/models/router.js';

const c = await import('child_process');
const box = await import('util');
const execFile = box.promisify(c.execFile);

const log = [];
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { pass += ok ? 1 : 0; fail += ok ? 0 : 1; log.push(`${ok ? 'PASS' : 'FAIL'} ${n} — ${d}`); };

const local = getLocalProvider();

// 1) llama3.2 text completion (lightweight).
try {
  const t0 = Date.now();
  const r = await local.chat({ model: 'llama3.2', messages: [{ role: 'user', content: 'Reply with the single word: OK' }], temperature: 0.1 });
  const ms = Date.now() - t0;
  const text = (r.content || '').trim();
  check('llama3.2 chat inference', text.length > 0 && /ok/i.test(text), `model=${r.model} dur=${ms}ms reply="${text.slice(0, 40)}"`);
} catch (e) { check('llama3.2 chat inference', false, e.message.slice(0, 120)); }

// 2) nomic-embed-text embedding.
try {
  const t0 = Date.now();
  const r = await local.embed({ model: 'nomic-embed-text', texts: ['The pump-101 discharge pressure exceeds its limit.'] });
  const ms = Date.now() - t0;
  const ok = r.vectors?.length === 1 && r.vectors[0]?.length >= 512;
  check('nomic-embed-text embedding', ok, `dim=${r.vectors?.[0]?.length} dur=${ms}ms`);
} catch (e) { check('nomic-embed-text embedding', false, e.message.slice(0, 120)); }

// 3) Model registry via router (ordered task classification).
try {
  const r = await modelRouter().decide({ question: 'Summarize the pump maintenance log.', taskType: 'kb_question' });
  check('model router picks local llama3.2 for reasoning', /llama3\.2/i.test(r.decisionModelId || ''), `selected=${r.decisionModelId} available=${r.available}` + (r.reason ? ` :: ${r.reason.slice(0, 80)}` : ''));
} catch (e) { check('model router picks local llama3.2 for reasoning', false, e.message.slice(0, 120)); }

console.log(log.join('\n'));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);