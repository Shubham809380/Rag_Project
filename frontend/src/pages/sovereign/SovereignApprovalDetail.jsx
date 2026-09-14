import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LoaderCircle as Loader2,
  ArrowLeft,
  ShieldAlert,
  CheckSquare,
  XSquare,
  FileOutput,
  Database,
  CircleCheck as CheckCircle,
  Clock,
  Cpu,
} from 'lucide-react';
import { getSovereignTask, approveSovereignTask, sovereignArtifactUrl } from '../../services/sovereign';

const card = { background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' };

const riskColor = (r) => (r === 'high' ? '#EF4444' : r === 'medium' ? '#F59E0B' : '#10B981');
const riskBg = (r) => (r === 'high' ? 'rgba(239,68,68,.12)' : r === 'medium' ? 'rgba(245,158,11,.12)' : 'rgba(16,185,129,.12)');

export default function SovereignApprovalDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getSovereignTask(id);
      if (!r.task) throw new Error('not found');
      setTask(r.task);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getSovereignTask(id);
        if (cancelled) return;
        if (!r.task) throw new Error('not found');
        setTask(r.task);
      } catch (e) {
        if (cancelled) return;
        setError(e?.response?.data?.error || e.message || 'Failed to load task');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const onAct = async () => {
    setActing(true);
    setActionResult(null);
    try {
      const r = await approveSovereignTask(id, decision, note.trim());
      if (r.ok === false || r.success === false) {
        setActionResult({ ok: false, message: r.reason || r.error || 'Approval failed' });
      } else {
        setActionResult({ ok: true, message: `Task ${decision}.` });
        setTimeout(load, 400);
      }
    } catch (e) {
      setActionResult({ ok: false, message: e?.response?.data?.reason || e?.response?.data?.error || e.message || 'Approval failed' });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-[13px]" style={{ color: 'var(--text-muted)' }}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading task…
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-6">
        <div className="rounded-lg border p-4 text-[13px] flex items-center gap-2" style={{ borderColor: 'rgba(239,68,68,.4)', color: '#EF4444', background: 'rgba(239,68,68,.08)' }}>
          <ShieldAlert className="w-4 h-4" /> {error || 'Task not found'}
        </div>
        <button onClick={() => nav('/workbench/approvals')} className="mt-4 text-[13px] flex items-center gap-1 hover:underline" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Approvals
        </button>
      </div>
    );
  }

  const isPending = task.status === 'waiting_approval' || task.approvalStatus === 'pending' || task.approvalStatus === null;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <button onClick={() => nav('/workbench/approvals')} className="text-[13px] flex items-center gap-1 hover:underline" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Approvals
      </button>

      <div className="rounded-xl border p-4" style={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>{task.title || task.question}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-mono" style={{ background: riskBg(task.approvalRisk), color: riskColor(task.approvalRisk) }}>
                {task.approvalRisk || 'low'} risk
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,.12)', color: '#3B82F6' }}>{task.taskType}</span>
            </div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Requested by <span className="font-mono">{task.userEmail}</span> · task <span className="font-mono">{task.id}</span>
            </div>
            <div className="text-[13px] mt-3 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{task.question}</div>
          </div>
          <div className="text-[12px] shrink-0">
            <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Clock className="w-3.5 h-3.5" /> {new Date(task.createdAt).toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-1" style={{ color: 'var(--text-muted)' }}><Cpu className="w-3.5 h-3.5" /> <span className="font-mono">{task.model || 'local gateway'}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* plan */}
          {Array.isArray(task.plan) && task.plan.length > 0 && (
            <div className="rounded-xl border p-4" style={card}>
              <div className="text-[11px] uppercase tracking-wide font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Agent Plan</div>
              <ol className="space-y-1.5 text-[13px]">
                {task.plan.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-mono text-[11px] mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{typeof p === 'string' ? p : p.desc || p.step || JSON.stringify(p)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* trace */}
          <div className="rounded-xl border p-4" style={card}>
            <div className="text-[11px] uppercase tracking-wide font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Execution Trace</div>
            {Array.isArray(task.trace) && task.trace.length > 0 ? (
              <div className="space-y-2">
                {task.trace.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <span className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                      style={{ background: t.outcome?.error ? '#EF4444' : t.step === 'generate' && t.note === 'model_unavailable' ? '#F59E0B' : '#10B981' }} />
                    <div className="min-w-0">
                      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{t.step || t.tool || 'step'}</span>
                      {t.tool && <span className="ml-2 font-mono" style={{ color: 'var(--text-muted)' }}>{t.tool}</span>}
                      {t.model && <span className="ml-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{t.model}</span>}
                      {t.elapsedMs != null && <span className="ml-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{t.elapsedMs}ms</span>}
                      {t.note === 'model_unavailable' && <span className="ml-2 text-[11px]" style={{ color: '#F59E0B' }}>model_unavailable</span>}
                      {t.outcome?.error && <span className="block mt-0.5 font-mono text-[11px]" style={{ color: '#EF4444' }}>{t.outcome.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No execution trace recorded.</div>
            )}
          </div>

          {/* answer */}
          {(task.answer || task.result) && (
            <div className="rounded-xl border p-4" style={card}>
              <div className="text-[11px] uppercase tracking-wide font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Answer</div>
              <pre className="text-[13px] whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>{task.answer || task.result}</pre>
            </div>
          )}

          {/* artifacts */}
          {Array.isArray(task.artifacts) && task.artifacts.length > 0 && (
            <div className="rounded-xl border p-4" style={card}>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                <FileOutput className="w-3.5 h-3.5" /> Generated Deliverables
              </div>
              <div className="space-y-1.5">
                {task.artifacts.map(a => (
                  <a key={a.id} href={sovereignArtifactUrl(a.id)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-[12px] hover:underline" style={{ color: 'var(--text-primary)' }}>
                    <Database className="w-3.5 h-3.5" style={{ color: '#14B8A6' }} />
                    <span className="font-mono">{a.name}</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>({a.type})</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* decision panel */}
        <div className="rounded-xl border p-4 h-fit" style={card}>
          <div className="flex items-center gap-2 text-[13px] font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
            <ShieldAlert className="w-4 h-4" style={{ color: '#F59E0B' }} /> Approval Decision
          </div>
          <div className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
            Only authorized reviewers can decide this task. Both actions are recorded to the tamper-evident audit chain.
          </div>

          {!isPending ? (
            <div className="rounded-lg p-3 text-[12px] flex items-center gap-2"
              style={{ background: task.approvalStatus === 'approved' ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)', color: task.approvalStatus === 'approved' ? '#10B981' : '#EF4444' }}>
              <CheckCircle className="w-4 h-4" /> {task.approvalStatus === 'approved' ? 'Approved' : 'Rejected'} — this task is closed.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setDecision('approved')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium ${decision === 'approved' ? '' : 'opacity-60'}`}
                  style={decision === 'approved' ? { background: 'rgba(16,185,129,.15)', color: '#10B981', border: '1px solid rgba(16,185,129,.5)' } : { border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <CheckSquare className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => setDecision('rejected')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium ${decision === 'rejected' ? '' : 'opacity-60'}`}
                  style={decision === 'rejected' ? { background: 'rgba(239,68,68,.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,.5)' } : { border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <XSquare className="w-4 h-4" /> Reject
                </button>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reviewer note (required for rejection, recommended always)"
                rows={3}
                className="w-full rounded-md border p-2 text-[12px] focus:outline-none focus:ring-1"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              />
              <button onClick={onAct} disabled={acting || (decision === 'rejected' && !note.trim())}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium disabled:opacity-40"
                style={decision === 'approved' ? { background: '#10B981', color: '#fff' } : { background: '#EF4444', color: '#fff' }}>
                {acting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : (decision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection')}
              </button>
              {actionResult && (
                <div className={`text-[12px] flex items-center gap-2 px-3 py-2 rounded-md`}
                  style={actionResult.ok ? { background: 'rgba(16,185,129,.08)', color: '#10B981' } : { background: 'rgba(239,68,68,.08)', color: '#EF4444' }}>
                  {actionResult.ok ? <CheckCircle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />} {actionResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}