import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Play, Copy, Check, Clock, ListChecks, Workflow, FileOutput,
  Database, Search, Cpu, AlertTriangle, RefreshCw, History,
  BarChart3, CircleCheck, LoaderCircle,
} from 'lucide-react';

const POLL_MS = 2500;

const STATUS_COLORS = {
  running: { dot: '#3B82F6', label: 'Running' },
  completed: { dot: '#10B981', label: 'Completed' },
  failed: { dot: '#EF4444', label: 'Failed' },
  waiting_approval: { dot: '#F59E0B', label: 'Waiting Approval' },
};

const RISK_COLORS = { low: '#10B981', medium: '#F59E0B', high: '#EF4444' };

const ARTIFACT_ICONS = {
  xlsx: Database, docx: FileOutput, pdf: FileOutput, pptx: FileOutput,
  py: FileOutput, report: FileOutput,
};

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.running;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs"
      style={{ backgroundColor: `${s.dot}22`, color: s.dot, border: `1px solid ${s.dot}44` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}

function RiskBadge({ risk }) {
  if (!risk) return null;
  const c = RISK_COLORS[risk] || '#888';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs"
      style={{ backgroundColor: `${c}22`, color: c, border: `1px solid ${c}44` }}
    >
      {risk.toUpperCase()} RISK
    </span>
  );
}

function Mono({ children, className = '' }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

/* ─── Left Pane: Task Queue ─────────────────────────────────────── */

function LeftPane({ tasks, activeTaskId, onSelect, onRefresh }) {
  return (
    <div
      className="h-full flex flex-col"
      style={{ width: 300, minWidth: 300, borderRight: '1px solid var(--border-subtle)' }}
    >
      {/* Queue header */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
            Task Queue <span className="font-mono" style={{ color: 'var(--text-muted)' }}>({tasks.length})</span>
          </span>
          <button
            onClick={onRefresh}
            className="p-1 rounded hover:opacity-80 transition"
            title="Refresh queue"
            style={{ color: 'var(--text-muted)' }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>
          run new tasks from the bar below
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {tasks.length === 0 && (
          <div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            No tasks yet
          </div>
        )}
        {tasks.map((t) => {
          const isActive = t.id === activeTaskId;
          const sc = STATUS_COLORS[t.status] || STATUS_COLORS.running;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2 transition text-xs"
              style={{
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                borderLeft: isActive ? `2px solid ${sc.dot}` : '2px solid transparent',
                color: 'var(--text-primary)',
              }}
            >
              {t.status === 'running' ? (
                <LoaderCircle size={13} className="mt-0.5 shrink-0 animate-spin" style={{ color: '#3B82F6' }} />
              ) : (
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: sc.dot }}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {t.taskType && (
                    <span
                      className="rounded px-1.5 py-0.5 text-darker font-medium"
                      style={{
                        fontSize: 10,
                        backgroundColor: '#3B82F622',
                        color: '#3B82F6',
                      }}
                    >
                      {t.taskType}
                    </span>
                  )}
                  <span
                    className="truncate font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t.title || t.question?.slice(0, 50) || 'Untitled'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--text-muted)' }}>
                  <Clock size={10} />
                  <span className="font-mono" style={{ fontSize: 10 }}>
                    {formatTime(t.createdAt)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Composer Bar (chat-style input) ─────────────────────────────── */

function ComposerBar({ onStart, starting, error }) {
  const [question, setQuestion] = useState('');
  const [localError, setLocalError] = useState('');
  const err = error || localError;

  const submit = () => {
    if (!question.trim() || starting) return;
    setLocalError('');
    onStart(question.trim());
    setQuestion('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="flex items-end gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI workbench anything… (Ctrl+Enter to run)"
          rows={1}
          className="flex-1 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        />
        <button
          onClick={submit}
          disabled={starting || !question.trim()}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition disabled:opacity-40"
          style={{ backgroundColor: '#3B82F6', color: '#fff' }}
        >
          {starting ? <LoaderCircle size={12} className="animate-spin" /> : <Play size={12} />}
          {starting ? 'Running…' : 'Run'}
        </button>
      </div>
      {err && (
        <div
          className="mt-2 rounded px-2 py-1.5 text-xs flex items-start gap-1.5"
          style={{ backgroundColor: '#EF444422', color: '#EF4444', border: '1px solid #EF444444' }}
        >
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      <div className="mt-1 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Ctrl+Enter to run · output appears in the workspace above
      </div>
    </div>
  );
}

/* ─── Center Pane: Workspace ─────────────────────────────────────── */

function CenterPane({ task, artifacts, approvals, onStart, starting, composerError }) {
  const [tab, setTab] = useState('session');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [task?.trace, task?.status]);

  const waitingApproval = task?.status === 'waiting_approval';

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Tab Bar */}
      <div
        className="flex items-center gap-0 px-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        {[
          { id: 'session', label: 'SESSION', icon: History },
          { id: 'trace', label: 'PLAN & TRACE', icon: ListChecks },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition"
            style={{
              borderBottom: tab === id ? '2px solid #3B82F6' : '2px solid transparent',
              color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
        <div className="flex-1" />
        {task && <StatusBadge status={task.status} />}
      </div>

      {/* Approval Strip */}
      {waitingApproval && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium"
          style={{
            backgroundColor: '#F59E0B15',
            borderBottom: '1px solid #F59E0B44',
            color: '#F59E0B',
          }}
        >
          <AlertTriangle size={14} />
          <span>Waiting for approval</span>
          {task.approvalNote && (
            <span style={{ color: 'var(--text-muted)' }}>— {task.approvalNote}</span>
          )}
        </div>
      )}

      {/* Workspace (output) */}
      {task ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
          {tab === 'session' ? (
            <SessionView task={task} artifacts={artifacts} approvals={approvals} />
          ) : (
            <TraceView task={task} />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
          <div className="text-center">
            <Workflow size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Ask a question below to start a new task</p>
          </div>
        </div>
      )}

      {/* Composer (chat-style, pinned bottom) */}
      <ComposerBar onStart={onStart} starting={starting} error={composerError} />
    </div>
  );
}

function SessionView({ task, artifacts }) {
  const trace = task.trace || [];
  const plan = task.plan || [];
  const sources = task.sources || [];
  const displayArtifacts = artifacts || task.artifacts || [];

  return (
    <div className="space-y-3">
      {/* Plan checklist */}
      {plan.length > 0 && (
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
            <ListChecks size={13} />
            Plan ({plan.length} steps)
          </div>
          <div className="space-y-1">
            {plan.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-mono mt-0.5 shrink-0" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{typeof item === 'string' ? item : item.description || item.text || JSON.stringify(item)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trace Steps */}
      {trace.map((step, idx) => (
        <TraceStepCard key={idx} step={step} />
      ))}

      {/* Answer */}
      {task.status === 'completed' && trace.some((s) => s.step === 'answer') && (
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
            <BarChart3 size={13} />
            Answer
          </div>
          <div
            className="text-xs whitespace-pre-wrap font-mono leading-relaxed"
            style={{ color: 'var(--text-primary)' }}
          >
            {trace.find((s) => s.step === 'answer')?.answer ||
              trace
                .filter((s) => s.step === 'generate' && s.outcome)
                .map((s) => s.outcome)
                .join('\n') ||
              'No answer content'}
          </div>
        </div>
      )}

      {/* Error */}
      {task.status === 'failed' && task.error && (
        <div
          className="rounded-lg p-3 flex items-start gap-2 text-xs"
          style={{ backgroundColor: '#EF444415', border: '1px solid #EF444444', color: '#EF4444' }}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span className="whitespace-pre-wrap">{task.error}</span>
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
            <Database size={13} />
            SOURCES
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((src, i) => (
              <a
                key={src.id || i}
                href={`/api/sovereign/documents/${src.id}/source`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition hover:opacity-80"
                style={{
                  backgroundColor: '#3B82F618',
                  color: '#3B82F6',
                  border: '1px solid #3B82F633',
                }}
                title={src.snippet || src.name}
              >
                <Search size={10} />
                <span className="truncate max-w-[140px]">{src.name}</span>
                {src.score != null && (
                  <span className="font-mono opacity-60" style={{ fontSize: 10 }}>
                    {typeof src.score === 'number' ? src.score.toFixed(2) : src.score}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Artifacts */}
      {displayArtifacts.length > 0 && (
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
            <FileOutput size={13} />
            Artifacts
          </div>
          <div className="space-y-1.5">
            {displayArtifacts.map((a) => {
              const Icon = ARTIFACT_ICONS[a.type] || FileOutput;
              return (
                <a
                  key={a.id}
                  href={`/api/sovereign/artifacts/${a.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs transition hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Icon size={13} style={{ color: '#3B82F6' }} />
                  <span className="truncate flex-1">{a.name}</span>
                  {a.size && (
                    <span className="font-mono shrink-0" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      {(a.size / 1024).toFixed(1)}KB
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TraceStepCard({ step }) {
  if (step.step === 'tool' || step.step === 'execute') {
    const ok = !step.outcome?.error && !step.outcome?.includes?.('error');
    return (
      <div
        className="rounded-lg p-3 flex items-start gap-2.5 text-xs"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div
          className="shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5"
          style={{ backgroundColor: '#3B82F622' }}
        >
          <Cpu size={13} style={{ color: '#3B82F6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--text-muted)' }}>Calling tool</span>
            <Mono className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {step.tool}
            </Mono>
            {step.elapsedMs != null && (
              <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {step.elapsedMs}ms
              </span>
            )}
          </div>
          {step.outcome && (
            <div className="mt-1.5 flex items-start gap-1.5" style={{ color: ok ? '#10B981' : '#EF4444' }}>
              {ok ? <CircleCheck size={12} className="mt-0.5 shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
              <span className="whitespace-pre-wrap break-words">
                {typeof step.outcome === 'string'
                  ? step.outcome
                  : step.outcome.error || JSON.stringify(step.outcome)}
              </span>
            </div>
          )}
        </div>
        <span className="font-mono shrink-0 mt-0.5" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          #{step.stepIndex ?? '—'}
        </span>
      </div>
    );
  }

  if (step.step === 'generate') {
    if (step.note === 'model_unavailable') {
      return (
        <div
          className="rounded-lg p-3 flex items-start gap-2.5 text-xs"
          style={{ backgroundColor: '#EF444415', border: '1px solid #EF444444' }}
        >
          <div
            className="shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5"
            style={{ backgroundColor: '#EF444422' }}
          >
            <AlertTriangle size={13} style={{ color: '#EF4444' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium" style={{ color: '#EF4444' }}>
              model_unavailable
            </div>
            <div className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              {step.message || 'No language model is currently available on the gateway.'}
            </div>
            {step.reason && (
              <div className="mt-1 font-mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                Reason: {step.reason}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className="rounded-lg p-3 flex items-start gap-2.5 text-xs"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div
          className="shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5"
          style={{ backgroundColor: '#10B98122' }}
        >
          <Cpu size={13} style={{ color: '#10B981' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--text-muted)' }}>Local model</span>
            {step.model && (
              <Mono className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {step.model}
              </Mono>
            )}
          </div>
          {step.reason && (
            <div className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              {step.reason}
            </div>
          )}
          {step.outcome && (
            <div className="mt-1.5 whitespace-pre-wrap break-words" style={{ color: 'var(--text-secondary)' }}>
              {step.outcome}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step.step === 'answer') {
    return (
      <div
        className="rounded-lg p-3 flex items-start gap-2.5 text-xs"
        style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}
      >
        <div
          className="shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5"
          style={{ backgroundColor: '#3B82F622' }}
        >
          <BarChart3 size={13} style={{ color: '#3B82F6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--text-muted)' }}>Final answer</span>
            {step.model && (
              <Mono style={{ color: 'var(--text-muted)', fontSize: 10 }}>{step.model}</Mono>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function TraceView({ task }) {
  const plan = task.plan || [];
  const trace = task.trace || [];

  return (
    <div className="space-y-3">
      {plan.length > 0 && (
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
            <ListChecks size={13} />
            Execution Plan
          </div>
          <div className="space-y-1.5">
            {plan.map((item, i) => {
              const text = typeof item === 'string' ? item : item.description || item.text || JSON.stringify(item);
              return (
                <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span
                    className="font-mono mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center"
                    style={{ fontSize: 10, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="whitespace-pre-wrap break-words">{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {trace.length > 0 && (
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
            <Workflow size={13} />
            Trace Log
          </div>
          <div className="space-y-1">
            {trace.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                style={{ backgroundColor: 'var(--bg-base)' }}
              >
                <span className="font-mono shrink-0" style={{ fontSize: 10, color: 'var(--text-muted)', width: 24 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-mono shrink-0" style={{ color: '#3B82F6', fontSize: 10, width: 60 }}>
                  {s.step}
                </span>
                {s.tool && (
                  <Mono style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{s.tool}</Mono>
                )}
                {s.model && (
                  <Mono style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.model}</Mono>
                )}
                {s.elapsedMs != null && (
                  <span className="font-mono shrink-0" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {s.elapsedMs}ms
                  </span>
                )}
                {s.note && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.note}</span>
                )}
                {s.outcome && (
                  <span className="truncate flex-1" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                    {typeof s.outcome === 'string' ? s.outcome.slice(0, 80) : 'ok'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.length === 0 && trace.length === 0 && (
        <div className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No plan or trace data available yet.
        </div>
      )}
    </div>
  );
}

/* ─── Right Pane: Details / Fact Sheet ──────────────────────────── */

function RightPane({ task, systemStatus }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (task?.id) {
      copyToClipboard(task.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      className="h-full flex flex-col overflow-y-auto"
      style={{ width: 300, minWidth: 300, borderLeft: '1px solid var(--border-subtle)', scrollbarWidth: 'thin' }}
    >
      {task ? (
        <>
          <div className="p-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
              Task Details
            </div>

            {/* Task ID */}
            <div className="mb-2">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Task ID</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mono className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
                  {task.id}
                </Mono>
                <button
                  onClick={handleCopy}
                  className="p-0.5 rounded transition hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  title="Copy ID"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="mb-2">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Status</div>
              <div className="mt-0.5">
                <StatusBadge status={task.status} />
              </div>
            </div>

            {/* Risk */}
            {task.approvalRisk && (
              <div className="mb-2">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Risk</div>
                <div className="mt-0.5">
                  <RiskBadge risk={task.approvalRisk} />
                </div>
              </div>
            )}

            {/* Model */}
            {task.model && (
              <div className="mb-2">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Model</div>
                <Mono className="text-xs mt-0.5 block" style={{ color: 'var(--text-secondary)' }}>
                  {task.model}
                </Mono>
              </div>
            )}

            {/* Workflow */}
            {task.workflow && (
              <div className="mb-2">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Workflow</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {task.workflow}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="mb-2">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Created</div>
              <Mono className="text-xs mt-0.5 block" style={{ color: 'var(--text-secondary)' }}>
                {formatDate(task.createdAt)}
              </Mono>
            </div>
            {task.updatedAt && (
              <div className="mb-2">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Updated</div>
                <Mono className="text-xs mt-0.5 block" style={{ color: 'var(--text-secondary)' }}>
                  {formatDate(task.updatedAt)}
                </Mono>
              </div>
            )}
            {task.completedAt && (
              <div className="mb-2">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Completed</div>
                <Mono className="text-xs mt-0.5 block" style={{ color: 'var(--text-secondary)' }}>
                  {formatDate(task.completedAt)}
                </Mono>
              </div>
            )}
          </div>

          {/* Approval */}
          <div className="p-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
              Approval
            </div>
            <div className="mb-1.5">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Status</div>
              <div className="mt-0.5">
                {task.approvalStatus ? (
                  <StatusBadge status={task.status === 'waiting_approval' ? 'waiting_approval' : task.approvalStatus === 'approved' ? 'completed' : 'failed'} />
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            </div>
            {task.approvalNote && (
              <div className="mt-1.5 text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--text-secondary)' }}>
                {task.approvalNote}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="p-3">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Select a task to view details.
          </div>
        </div>
      )}

      {/* System Card */}
      <div className="p-3 mt-auto">
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
            <Cpu size={13} />
            System
          </div>
          {systemStatus ? (
            <div className="space-y-1.5 text-xs">
              {systemStatus.models?.map((m, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: m.status === 'available' ? '#10B981' : '#EF4444' }}
                  />
                  <Mono style={{ color: 'var(--text-secondary)' }}>{m.name || m.id || 'Unknown'}</Mono>
                  {m.status !== 'available' && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(offline)</span>
                  )}
                </div>
              ))}
              {(!systemStatus.models || systemStatus.models.length === 0) && (
                <div style={{ color: 'var(--text-muted)' }}>No models configured</div>
              )}
            </div>
          ) : (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Workbench ──────────────────────────────────────────── */

export default function SovereignWorkbench() {
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [_loadingTask, setLoadingTask] = useState(false);
  const [startingComposer, setStartingComposer] = useState(false);
  const [composerError, setComposerError] = useState('');

  const pollRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await axios.get('/api/sovereign/tasks');
      setTasks(res.data.tasks || []);
    } catch {
      /* silent */
    }
  }, []);

  const fetchActiveTask = useCallback(async (id) => {
    if (!id) {
      setActiveTask(null);
      setArtifacts([]);
      setApprovals([]);
      return;
    }
    try {
      setLoadingTask(true);
      const res = await axios.get(`/api/sovereign/tasks/${id}`);
      setActiveTask(res.data.task || null);
      setArtifacts(res.data.artifacts || []);
      setApprovals(res.data.approvals || []);
    } catch {
      /* silent */
    } finally {
      setLoadingTask(false);
    }
  }, []);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/sovereign/status');
      setSystemStatus(res.data);
    } catch {
      /* silent */
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTasks();
    fetchSystemStatus();
  }, [fetchTasks, fetchSystemStatus]);

  // Load active task when ID changes
  useEffect(() => {
    fetchActiveTask(activeTaskId);
  }, [activeTaskId, fetchActiveTask]);

  // Poll running tasks
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(() => {
      fetchTasks();

      if (activeTaskId && activeTask?.status === 'running') {
        fetchActiveTask(activeTaskId);
      }
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeTaskId, activeTask?.status, fetchTasks, fetchActiveTask]);

  const handleSelect = (id) => {
    setActiveTaskId(id);
  };

  const handleStart = useCallback(async (question) => {
    setStartingComposer(true);
    setComposerError('');
    try {
      const res = await axios.post('/api/sovereign/tasks/start', { question });
      const data = res.data;
      if (data.task || data.success) {
        fetchTasks();
        if (data.task?.id) setActiveTaskId(data.task.id);
        else if (data.taskId) setActiveTaskId(data.taskId);
      } else {
        setComposerError(data.error || 'Task failed to start');
      }
    } catch (e) {
      setComposerError(e.response?.data?.error || e.message || 'Network error');
    } finally {
      setStartingComposer(false);
    }
  }, [fetchTasks]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex min-h-0">
        <LeftPane
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelect={handleSelect}
          onRefresh={fetchTasks}
        />
        <CenterPane
          task={activeTask}
          artifacts={artifacts}
          approvals={approvals}
          onStart={handleStart}
          starting={startingComposer}
          composerError={composerError}
        />
        <RightPane task={activeTask} systemStatus={systemStatus} />
      </div>
    </div>
  );
}
