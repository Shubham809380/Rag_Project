import { useState } from 'react';
import {
  Bot, Loader2, ShieldCheck, ShieldX, FileText, Database, Calculator,
  CheckCircle2, AlertTriangle, GitBranch, Fingerprint, Play, Cpu, Boxes,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { startSovereignTask, approveSovereignTask, getSovereignTask, sovereignArtifactUrl } from '../services/sovereign';

function RiskBadge({ level }) {
  const map = {
    high: { c: '#EF4444', b: 'rgba(239,68,68,0.12)' },
    medium: { c: '#F59E0B', b: 'rgba(245,158,11,0.12)' },
    low: { c: '#10B981', b: 'rgba(16,185,129,0.12)' },
  };
  const s = map[level] || map.low;
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: s.c, background: s.b }}>{level} risk</span>;
}

function Cell({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
      <div className="flex items-center gap-2 mb-2 text-[12px] font-semibold text-fg-muted uppercase tracking-wide">
        <Icon size={14} /> {title}
      </div>
      <div className="text-[13px]">{children}</div>
    </div>
  );
}

export default function AgentWorkbench() {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [handling, setHandling] = useState(false);

  const launch = async () => {
    if (!question.trim()) return;
    setBusy(true); setResult(null);
    try {
      const r = await startSovereignTask(question.trim());
      setResult(r);
    } catch (e) {
      setResult({ error: e?.response?.data?.error || e?.message });
    } finally { setBusy(false); }
  };

  const act = async (decision, note = '') => {
    if (!result?.taskId) return;
    setHandling(true);
    try {
      await approveSovereignTask(result.taskId, decision, note);
      const ref = await getSovereignTask(result.taskId);
      setResult({ status: 'approved' === decision ? (ref.task.status || ref.status) : 'rejected', taskId: result.taskId, finalized: ref });
    } catch (e) {
      setResult({ ...result, error: e?.response?.data?.error || e?.message });
    } finally { setHandling(false); }
  };

  const isAwaiting = result?.status === 'awaiting_approval' || result?.task?.status === 'waiting_approval';

  return (
    <AppLayout title="Agent Workbench">
      <div className="p-6 space-y-6 max-w-6xl">
        {/* Composer */}
        <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Bot size={18} style={{ color: '#3B82F6' }} />
            <h2 className="text-[15px] font-bold text-heading">Run a sovereign agent task</h2>
          </div>
          <p className="text-[13px] text-fg-muted mb-3">
            Classified on-device and executed against local models, local RAG and local tools. Approval-gated item (procurement, approval notes, safety, financial) always stops for a human.
          </p>
          <div className="flex gap-2">
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={3}
              placeholder="e.g. Prepare an approval note for sole-source bearing replacement, cap 15L, verify against SOP-07 limit of 12L…"
              className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--fg)' }}
            />
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={launch} disabled={busy || !question.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#22D3EE)' }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {busy ? 'Running…' : 'Run task'}
            </button>
          </div>
        </div>

        {result?.error && <div className="text-error text-sm">{result.error}</div>}

        {/* Egressed state after run */}
        {!result?.error && result?.purpose === undefined && result && (
          <div className="space-y-4">
            {/* Awaiting approval gate */}
            {isAwaiting && (
              <div className="rounded-2xl border p-5 bg-amber-50 dark:bg-amber-950/30" style={{ borderColor: '#F59E0B66' }}>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldX size={20} style={{ color: '#F59E0B' }} />
                  <h3 className="font-bold text-heading">Awaiting human approval</h3>
                </div>
                <p className="text-sm text-fg-muted mb-2">
                  This task is {result?.gate?.risk?.risk ?? result?.task?.approval_risk} risk and cannot proceed until an authorised supervisor approves. No AI output or artifact was produced yet.
                </p>
                <div className="text-sm mb-3">Reason: <span className="text-heading">{result?.task?.error || result?.gate?.risk?.reason}</span></div>
                <div className="flex gap-2">
                  <button onClick={() => act('approved', 'Approved')} disabled={handling}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#10B981,#22D3EE)' }}>
                    {handling ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Approve &amp; run
                  </button>
                  <button onClick={() => act('rejected', 'Rejected by supervisor')} disabled={handling}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 bg-red-500">
                    <ShieldX size={16} /> Reject
                  </button>
                </div>
              </div>
            )}

            {/* model_unavailable packet */}
            {result?.status === 'model_unavailable' && result?.packet && (
              <>
                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                    <h3 className="font-bold text-heading">No verified local model output</h3>
                  </div>
                  <p className="text-sm text-fg-muted">
                    No local model is reachable, so <span className="font-semibold">no AI content was fabricated</span>. The deterministic packet below (retrieval + arithmetic + policy clauses only) is safe to review as-is.
                  </p>
                  {result.packet.message && <div className="mt-2 text-[13px]">{result.packet.message}</div>}
                </div>

                <PacketView packet={result.packet} />
              </>
            )}

            {/* finalized with generated content */}
            {result?.finalized && (result.finalized.task?.artifacts?.length > 0 || result.finalized.task?.status === 'completed') && (
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={18} style={{ color: '#10B981' }} />
                  <h3 className="font-bold text-heading">Task completed</h3>
                </div>
                <div className="text-sm text-fg-muted mb-3">
                  Status: <span className="text-heading">{result.finalized.task?.status}</span> · Generated: <span className="text-heading">{result.finalized.task?.artifacts?.length ? 'yes' : 'no'}</span>
                </div>
                {result.finalized.task?.artifacts?.map(a => (
                  <a key={a.id} href={sovereignArtifactUrl(a.id)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white font-semibold"
                    style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}>
                    <FileText size={15} /> {a.name} — download
                  </a>
                ))}
                {!result.finalized.task?.artifacts?.length && result.finalized.task?.status === 'completed' && (
                  <div className="text-sm text-fg">No durable artifact — check the trace.</div>
                )}
              </div>
            )}

            {/* Task id + trace */}
            {result?.packet?.trace && <TraceView trace={result.packet.trace} />}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PacketView({ packet }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Cell icon={Database} title="Gathered sources">
        {packet.gathered?.length ? (
          <ul className="space-y-1">{packet.gathered.map((g, i) => (
            <li key={i} className="text-[13px] text-fg">• {g.document}{g.page ? ` (p.${g.page})` : ''}{g.section ? ` — ${g.section}` : ''}</li>
          ))}</ul>
        ) : <div className="text-fg-muted">No documents in the local knowledge base yet.</div>}
      </Cell>
      <Cell icon={Calculator} title="Deterministic calculations">
        {packet.calculations?.length ? (
          <ul className="space-y-1">{packet.calculations.map((c, i) => (
            <li key={i} className="font-mono text-fg">{c.expression} = <span className="font-bold text-heading">{c.result}</span></li>
          ))}</ul>
        ) : <div className="text-fg-muted">None</div>}
      </Cell>
      <Cell icon={GitBranch} title="Workflow plan">
        <ol className="space-y-1">{packet.plan?.map((s, i) => (
          <li key={i} className="text-[13px] text-fg">{i + 1}. {s.step}{s.tool ? <span className="text-fg-muted"> (via {s.tool})</span> : null}</li>
        ))}</ol>
      </Cell>
      <Cell icon={Cpu} title="Sovereignty metadata">
        <div className="text-fg-muted text-[13px] space-y-1">
          <div>taskType: <span className="text-heading font-mono">{packet.taskType}</span></div>
          <div>workflow: <span className="text-heading font-mono">{packet.workflow}</span></div>
          <div>approval status: {packet.approvalStatus}</div>
        </div>
      </Cell>
    </div>
  );
}

function TraceView({ trace }) {
  return (
    <Cell icon={Boxes} title="Execution trace">
      {trace?.length ? (
        <ul className="space-y-1.5">{trace.map((t, i) => (
          <li key={i} className="text-[13px] flex items-center gap-2">
            <Fingerprint size={13} className="text-fg-muted shrink-0" />
            <span className="text-fg">{t.step}</span>
            {t.tool && <span className="text-fg-muted">({t.tool})</span>}
            <span className="ml-auto text-fg-muted">{t.elapsedMs ?? ''}{typeof t.elapsedMs === 'number' ? 'ms' : ''}</span>
            {t.note === 'model_unavailable' && <RiskBadge level="high" />}
          </li>
        ))}</ul>
      ) : <div className="text-fg-muted">—</div>}
    </Cell>
  );
}