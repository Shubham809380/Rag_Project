import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartColumn as BarChart3,
  CircleCheck as CheckCircle,
  LoaderCircle as Loader2,
  Wifi,
  XCircle,
  CloudOff,
  Database,
  FileText,
  ClipboardList,
  Package,
  Activity,
  ShieldCheck,
  ArrowRight,
  Clock,
  Radio,
  BookOpen,
  RefreshCw,
  Boxes,
  ScanSearch,
  Workflow,
  FileCode,
  LogOut,
} from 'lucide-react';
import { getSovereignDashboard } from '../../services/sovereign';
import { useSovereignAuth } from '../../context/SovereignAuthContext';
import StatusPill from '../../components/ui/StatusPill';

const RISK_TONE = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

const TASK_TONE = {
  completed: '#10B981',
  running: '#38BDF8',
  failed: '#EF4444',
  waiting_approval: '#F59E0B',
};

const AUTOMATION_MODULES = [
  { id: 'documents',  label: 'Documents',      desc: 'Knowledge base',   icon: FileText,     tone: '#3B82F6', to: '/workbench/documents' },
  { id: 'agent',      label: 'AI Workbench',   desc: 'Task orchestration', icon: Workflow,   tone: '#22D3EE', to: '/workbench/agent' },
  { id: 'data',       label: 'Data Analysis',  desc: 'Local profiles',   icon: Database,     tone: '#A78BFA', to: '/workbench/data-analysis' },
  { id: 'vision',     label: 'Vision Analysis', desc: 'On-device OCR',   icon: ScanSearch,   tone: '#F472B6', to: '/workbench/vision' },
  { id: 'coding',     label: 'Coding',         desc: 'Sandboxed Python', icon: FileCode,     tone: '#38BDF8', to: '/workbench/coding' },
  { id: 'deliverables', label: 'Deliverables', desc: 'Word · Excel · PDF', icon: Package,    tone: '#14B8A6', to: '/workbench/deliverables' },
  { id: 'approvals',  label: 'Approvals',      desc: 'Human-in-the-loop', icon: ClipboardList, tone: '#FBBF24', to: '/workbench/approvals' },
  { id: 'sovereignty', label: 'Sovereignty',   desc: 'Egress guard',     icon: ShieldCheck,  tone: '#FB7185', to: '/workbench/sovereignty' },
];

function moduleBadge(m, d) {
  const stats = d?.stats || {};
  switch (m.id) {
    case 'documents': return { text: String(stats.documents ?? d?.documents?.length ?? 0), small: true };
    case 'agent': return { text: `${String((d?.tasks || []).filter(t => t.status === 'running').length)} running`, small: true };
    case 'data': return { text: `${String(stats.chunks || 0)} chunks`, small: true };
    case 'vision': return { text: 'ON-DEVICE', small: true };
    case 'coding': return { text: 'SANDBOXED', small: true };
    case 'deliverables': return { text: String(stats.artifacts ?? 0), small: true };
    case 'approvals': return { text: String((d?.pendingApprovals || []).length), small: true };
    case 'sovereignty': return { text: String((d?.telemetry?.blockedEgress ?? 0)), small: true };
    default: return { text: '', small: true };
  }
};

function ModuleGrid({ data, nav }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {AUTOMATION_MODULES.map((m) => {
        const Icon = m.icon;
        const badge = moduleBadge(m, data);
        return (
          <button
            key={m.id}
            onClick={() => nav(m.to)}
            className="group relative rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: 'var(--bg-base)',
              borderColor: 'var(--border-subtle)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${m.tone}66`; e.currentTarget.style.background = `${m.tone}0d`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-base)'; }}
          >
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${m.tone}1a`, border: `1px solid ${m.tone}30` }}>
                <Icon className="w-4 h-4" style={{ color: m.tone }} />
              </span>
              {badge.text && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: m.tone, background: `${m.tone}14` }}>
                  {badge.text}
                </span>
              )}
            </div>
            <div className="mt-2.5 text-[12px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{m.label}</div>
            <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{m.desc}</div>
            <div className="invisible group-hover:visible text-[9px] font-mono uppercase tracking-wider mt-1.5 flex items-center gap-1" style={{ color: m.tone }}>
              Open <ArrowRight className="w-3 h-3" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function SovereignDashboard() {
  const nav = useNavigate();
  const { logout } = useSovereignAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleLogout = async () => {
    try { await logout(); } catch { /* best-effort */ }
    nav('/workbench/login', { replace: true });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getSovereignDashboard();
      setData(d);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-[13px]" style={{ color: 'var(--text-muted)' }}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading command center…
      </div>
    );
  }

  const stats = data?.stats || {};
  const tel = data?.telemetry || {};
  const events = data?.egressEvents || [];
  const pending = data?.pendingApprovals || [];
  const tasks = data?.tasks || [];
  const docs = data?.documents || [];

  const StatCard = ({ icon: Icon, label, value, sub, onClick, tone }) => (
    <div onClick={onClick} className="tech-card p-4 cursor-pointer hover:opacity-95">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${tone || '#38BDF8'}1a`, border: `1px solid ${tone || '#38BDF8'}30` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: tone || '#38BDF8' }} />
        </span>
      </div>
      <div className="text-[26px] font-bold font-mono leading-none" style={{ color: 'var(--text-heading)' }}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );

  const paneHead = ({ icon: Icon, title, tone, action, onAction }) => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
        <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${tone}1a`, border: `1px solid ${tone}30` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: tone }} />
        </span>
        {title}
      </div>
      {onAction && (
        <button onClick={onAction} className="flex items-center gap-1 text-[12px] hover:underline" style={{ color: 'var(--text-secondary)' }}>
          {action} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-[1500px]">
      {error && (
        <div className="rounded-lg border p-3 text-[12px] flex items-center gap-2" style={{ borderColor: 'rgba(239,68,68,.4)', color: '#EF4444', background: 'rgba(239,68,68,.08)' }}>
          <XCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Hero command strip */}
      <div className="glass-panel hud rounded-2xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-5 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(50% 90% at 8% 0%, rgba(34,211,238,0.08), transparent 55%)' }} />
        <div className="flex items-center gap-4 relative">
          <span className="hidden md:flex w-12 h-12 rounded-2xl items-center justify-center" style={{ background: 'linear-gradient(135deg,#38BDF8,#22D3EE)', boxShadow: '0 6px 24px rgba(34,211,238,0.35)' }}>
            <ShieldCheck className="w-6 h-6 text-slate-950" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
                SOVEREIGN MODE ACTIVE
              </span>
              <div className="flex gap-1.5">
                <StatusPill tone="#34D399" mono>on-premises</StatusPill>
                <StatusPill tone="#10B981" mono>egress blocked</StatusPill>
                <StatusPill tone="#F59E0B" mono>cloud ai disabled</StatusPill>
              </div>
            </div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              All models, retrieval, analysis and data stay inside the plant network. Zero cloud dependencies.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono relative">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,.1)', color: '#10B981', border: '1px solid rgba(16,185,129,.25)' }}>
            <Wifi className="w-3.5 h-3.5" /> EGRESS DENY
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,.25)' }}>
            <CloudOff className="w-3.5 h-3.5" /> 0 UNTRUSTED CALLS
          </span>
          <button onClick={load} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-white/5 transition-colors" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: real-time stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={FileText} label="Documents" value={stats.documents ?? docs.length} sub={`${stats.chunks || 0} chunks indexed`} tone="#3B82F6" onClick={() => nav('/workbench/documents')} />
            <StatCard icon={ClipboardList} label="Tasks" value={stats.tasks ?? tasks.length} sub={`${tasks.filter(t => t.status === 'running').length} running`} tone="#8B5CF6" onClick={() => nav('/workbench/agent')} />
            <StatCard icon={CheckCircle} label="Pending Approvals" value={pending.length} sub={pending.length ? 'awaiting review' : 'all clear'} tone={pending.length ? '#F59E0B' : '#10B981'} onClick={() => nav('/workbench/approvals')} />
            <StatCard icon={Package} label="Deliverables" value={stats.artifacts ?? 0} sub="reports · sheets · docs" tone="#14B8A6" onClick={() => nav('/workbench/deliverables')} />
            <StatCard icon={Radio} label="External API Calls" value={tel.externalApiCalls ?? 0} sub="app-layer egress guard" tone="#10B981" />
            <StatCard icon={Activity} label="Blocked Egress" value={tel.blockedEgress ?? 0} sub="attempts intercepted" tone="#EF4444" />
          </div>

          {/* Pending approvals */}
          <div className="tech-card p-4">
            {paneHead({ icon: Clock, title: 'Pending Approvals', tone: '#F59E0B', action: 'View all', onAction: () => nav('/workbench/approvals') })}
            {pending.length === 0 ? (
              <div className="text-[12px] py-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle className="w-4 h-4" style={{ color: '#10B981' }} /> All approvals are currently completed.
              </div>
            ) : (
              <div className="space-y-2">
                {pending.slice(0, 6).map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.title || t.question}</div>
                      <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{t.taskType} · {t.id.slice(0, 8)}</div>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full font-mono uppercase tracking-wider shrink-0"
                      style={{ background: `${RISK_TONE[t.approvalRisk] || RISK_TONE.low}14`, color: RISK_TONE[t.approvalRisk] || RISK_TONE.low, border: `1px solid ${RISK_TONE[t.approvalRisk] || RISK_TONE.low}30` }}>
                      {t.approvalRisk || 'low'} risk
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent tasks */}
          <div className="tech-card p-4">
            {paneHead({ icon: BarChart3, title: 'Recent Tasks', tone: '#8B5CF6', action: 'Open workbench', onAction: () => nav('/workbench/agent') })}
            {tasks.length === 0 ? (
              <div className="text-[12px] py-4" style={{ color: 'var(--text-muted)' }}>No tasks yet. Launch a task in the AI Workbench.</div>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 8).map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.title || t.question}</div>
                      <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{t.taskType} · {new Date(t.createdAt).toLocaleString()}</div>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full font-mono uppercase tracking-wider shrink-0"
                      style={{ background: `${TASK_TONE[t.status] || '#94A3B8'}14`, color: TASK_TONE[t.status] || '#94A3B8', border: `1px solid ${TASK_TONE[t.status] || '#94A3B8'}30` }}>
                      {t.status === 'waiting_approval' ? 'awaiting approval' : t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automation modules quick-launch */}
          <div className="tech-card p-4">
            {paneHead({ icon: Boxes, title: 'Automation Modules', tone: '#38BDF8', action: 'Open workbench', onAction: () => nav('/workbench/agent') })}
            <ModuleGrid data={data} nav={nav} />
          </div>
        </div>

        {/* Right: system panels */}
        <div className="space-y-6">
          <div className="tech-card p-4">
            {paneHead({ icon: BookOpen, title: 'Knowledge Base', tone: '#3B82F6', action: 'Manage', onAction: () => nav('/workbench/documents') })}
            <div className="text-[12px] space-y-2" style={{ color: 'var(--text-secondary)' }}>
              {[
                ['Collections', stats.collections ?? data?.collections?.length],
                ['Documents', stats.documents ?? docs.length],
                ['Chunks / vectors', stats.chunks || 0],
                ['RAG queries', tel.localRagQueries ?? 0],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center py-0.5" style={{ borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4">
            {paneHead({ icon: ShieldCheck, title: 'Egress Guard & Network Monitor', tone: '#10B981' })}
            {/* boundary diagram */}
            <div className="relative flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 mb-3"
              style={{ background: 'rgba(7,11,20,0.55)', border: '1px dashed rgba(239,68,68,0.28)' }}>
              <div className="text-center">
                <div className="text-[9px] font-mono tracking-[0.18em] text-slate-500">INTERNET / CLOUD</div>
                <div className="mt-0.5 text-[11px] font-bold text-red-400">⨯ DENIED</div>
              </div>
              <div className="h-px flex-1 mx-2 relative" style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.6), rgba(239,68,68,0.2))' }} />
              <div className="text-center">
                <div className="text-[9px] font-mono tracking-[0.18em] text-cyan-300/80">NETWORK-ISOLATED ZONE</div>
                <div className="mt-0.5 text-[11px] font-bold text-cyan-300">LOCAL AI WORKBENCH</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <StatusPill tone="#10B981" mono>{data?.mode || 'local'} · no external calls</StatusPill>
              <StatusPill tone="#EF4444" mono>egress blocked</StatusPill>
              <StatusPill tone={data?.chainVerified ? '#10B981' : '#EF4444'} mono>{data?.chainVerified ? 'audit verified' : 'audit modified'}</StatusPill>
            </div>
            <div className="space-y-1.5 text-[12px]">
              {[
                ['Blocked egress attempts', tel.blockedEgress ?? 0, tel.blockedEgress > 0 ? '#FBBF24' : '#34D399'],
                ['External API calls', tel.externalApiCalls ?? 0, (tel.externalApiCalls ?? 0) > 0 ? '#EF4444' : '#10B981'],
                ['Cloud AI calls', tel.cloudModelCalls ?? 0, (tel.cloudModelCalls ?? 0) > 0 ? '#EF4444' : '#10B981'],
                ['Local RAG queries', tel.localRagQueries ?? 0, '#38BDF8'],
              ].map(([k, v, c]) => (
                <div key={k} className="flex justify-between items-center" style={{ borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span className="font-mono font-semibold" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="tech-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)' }}>
                  <Database className="w-3.5 h-3.5" style={{ color: '#14B8A6' }} />
                </span>
                System Events
              </div>
              <button onClick={load} className="hover:opacity-70 p-1" title="Refresh"><RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            {events.length === 0 ? (
              <div className="text-[12px] py-3" style={{ color: 'var(--text-muted)' }}>No sovereignty events recorded.</div>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 7).map((e, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: e.eventType === 'egress_block' ? '#EF4444' : e.eventType === 'egress_attempt' ? '#F59E0B' : e.eventType === 'local_model' ? '#10B981' : '#3B82F6' }} />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        {e.eventType === 'egress_block' ? 'External request blocked' : e.eventType === 'egress_attempt' ? 'Outbound attempt intercepted' : e.eventType === 'local_model' ? 'Local model served' : e.eventType}
                      </div>
                      <div className="text-[11px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>{e.destination || e.detail || ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="tech-card p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Audit Chain</div>
              <div className="text-[13px] font-medium mt-1 flex items-center gap-2" style={{ color: data?.chainVerified ? '#10B981' : '#EF4444' }}>
                <Boxes className="w-4 h-4" />
                {data?.chainVerified ? 'Integrity verified — tamper-evident' : 'Chain modified'}
              </div>
            </div>
            <ShieldCheck className="w-5 h-5" style={{ color: data?.chainVerified ? '#10B981' : '#EF4444' }} />
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors hover:bg-[rgba(239,68,68,0.08)] hover:border-[rgba(239,68,68,0.3)] border"
          style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </div>
  );
}