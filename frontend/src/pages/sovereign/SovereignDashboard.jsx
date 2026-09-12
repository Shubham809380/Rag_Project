import { lazy, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { getSovereignDashboard } from '../../services/sovereign';
import ThreeScene, { use3DCapable } from '../../components/3d/ThreeScene';
import StatusPill from '../../components/ui/StatusPill';

const SmartCoreScene = lazy(() => import('../../components/3d/SmartCoreScene'));

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

export default function SovereignDashboard() {
  const nav = useNavigate();
  const capable = use3DCapable();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
            <StatCard icon={Radio} label="External API Calls" value={tel.externalApiCalls ?? 0} sub="zero outbound" tone="#10B981" />
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
        </div>

        {/* Right: 3D Smart Automation Core + system panels */}
        <div className="space-y-6">
          <div className="relative glass-panel rounded-2xl overflow-hidden hud" style={{ height: '340px' }}>
            <ThreeScene Scene={SmartCoreScene} enabled={capable} mode="compact" sceneProps={{ onNavigate: (to) => nav(to) }} />
            <div className="absolute top-3 left-4 z-10 flex items-center gap-2 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#22D3EE' }} />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>Smart Automation Core</span>
            </div>
            <div className="absolute bottom-3 inset-x-4 z-10 flex items-center justify-between pointer-events-none">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">Hover a module — click to open</span>
              {!capable && <ScanSearch className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
            </div>
          </div>

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
    </div>
  );
}