import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ChartColumn as BarChart3,
  Server,
  Cpu,
  Database,
  Box,
  Activity,
  HardDrive,
  GaugeCircle,
  CloudOff,
  ScrollText,
  CircleDot,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  LoaderCircle as Loader2,
} from 'lucide-react';
import { getSovereignStatus, getSovereignAudit } from '../../services/sovereign';

const POLL_INTERVAL_MS = 30000;

const STATUS_COLOR = {
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  blue: '#3B82F6',
};

const SEV_STYLE = {
  info:     { color: '#64748B', bg: 'rgba(100,116,139,0.10)' },
  notice:   { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
};

function StatusBadge({ color, label }) {
  const c = STATUS_COLOR[color] || color;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono uppercase"
      style={{ color: c, background: `${c}18` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {label}
    </span>
  );
}

function SevBadge({ severity }) {
  const s = SEV_STYLE[severity] || SEV_STYLE.info;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono"
      style={{ color: s.color, background: s.bg }}
    >
      {severity}
    </span>
  );
}

function ServiceCard({ icon: Icon, name, statusColor, statusLabel, detail }) {
  return (
    <div
      className="rounded-xl border p-4 flex items-start gap-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${STATUS_COLOR[statusColor] || '#6B7280'}18` }}
      >
        <Icon size={20} style={{ color: STATUS_COLOR[statusColor] || '#6B7280' }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>{name}</span>
          <StatusBadge color={statusColor} label={statusLabel} />
        </div>
        {detail && (
          <div className="font-mono text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{detail}</div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}
      >
        <Icon size={17} style={{ color }} />
      </div>
      <div>
        <div className="text-xl font-bold font-mono leading-none" style={{ color: 'var(--text-heading)' }}>{value}</div>
        <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function formatUptime(sec) {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SovereignMonitoring() {
  const [status, setStatus] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);

  const fetchData = useCallback(async (isPoll = false) => {
    if (isPoll) setPolling(true);
    else setLoading(true);
    setError('');
    try {
      const [s, a] = await Promise.all([
        getSovereignStatus(),
        getSovereignAudit({ limit: 10 }),
      ]);
      setStatus(s);
      setAuditData(a);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
      setPolling(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, a] = await Promise.all([
          getSovereignStatus(),
          getSovereignAudit({ limit: 10 }),
        ]);
        if (!active) return;
        setStatus(s);
        setAuditData(a);
      } catch (e) {
        setError(e?.response?.data?.error || e?.message || 'Failed to load monitoring data');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => { clearInterval(timerRef.current); };
  }, [fetchData]);

  const handleRefresh = () => fetchData(false);

  if (loading && !status) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3 py-20 justify-center" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" />
          <span>Loading monitoring data…</span>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="rounded-xl border p-6 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  const tel = status?.telemetry || {};
  const models = status?.models || [];
  const localServices = status?.localServices || [];
  const sandbox = status?.sandbox || {};
  const agent = status?.agent || {};
  const counts = status?.counts || {};
  const hw = status?.hardwareProfile || {};
  const storage = status?.storage || {};
  const auditEntries = auditData?.entries || [];

  const hasAvailableModel = models.some(m => m.status === 'available' || m.status === 'loaded' || m.status === 'ready');
  const modelDetail = models.length > 0
    ? `${models.length} model${models.length !== 1 ? 's' : ''} configured`
    : 'No models loaded';

  const ocrService = localServices.find(s => s.kind === 'local_ocr');
  const apiService = localServices.find(s => s.kind === 'local_api');

  const serviceCards = [
    {
      icon: Cpu,
      name: 'Local LLM / Gateway',
      statusColor: hasAvailableModel ? 'green' : models.length > 0 ? 'amber' : 'red',
      statusLabel: hasAvailableModel ? 'AVAILABLE' : models.length > 0 ? 'DEGRADED' : 'UNAVAILABLE',
      detail: modelDetail,
    },
    {
      icon: FileText,
      name: 'OCR',
      statusColor: ocrService ? 'green' : 'amber',
      statusLabel: ocrService ? 'ACTIVE' : 'NOT FOUND',
      detail: ocrService?.endpoint || 'No OCR service detected',
    },
    {
      icon: Database,
      name: 'RAG / Vector DB',
      statusColor: storage.backend ? 'green' : 'amber',
      statusLabel: storage.backend ? 'ACTIVE' : 'UNKNOWN',
      detail: storage.backend || 'No backend configured',
    },
    {
      icon: FileSpreadsheet,
      name: 'Knowledge Base',
      statusColor: (counts.documents ?? 0) > 0 ? 'green' : 'amber',
      statusLabel: (counts.documents ?? 0) > 0 ? 'ACTIVE' : 'EMPTY',
      detail: `${counts.documents ?? 0} documents · ${counts.collections ?? 0} collections`,
    },
    {
      icon: Box,
      name: 'Sandbox (Docker)',
      statusColor: sandbox.dockerAvailable ? 'green' : sandbox.dockerConfigured ? 'amber' : 'red',
      statusLabel: sandbox.dockerAvailable ? 'AVAILABLE' : sandbox.dockerConfigured ? 'CONFIGURED' : 'NOT CONFIGURED',
      detail: sandbox.dockerAvailable ? 'Docker daemon reachable' : sandbox.dockerConfigured ? 'Configured but unavailable' : 'No Docker runtime',
    },
    {
      icon: Server,
      name: 'Agent API',
      statusColor: apiService ? 'green' : 'amber',
      statusLabel: apiService ? 'ACTIVE' : 'NOT FOUND',
      detail: apiService?.endpoint || 'No agent API detected',
    },
  ];

  const metrics = [
    { icon: Activity, label: 'External API Calls', value: tel.externalApiCalls ?? 0, color: (tel.externalApiCalls ?? 0) > 0 ? '#F59E0B' : '#6B7280' },
    { icon: CloudOff, label: 'Blocked Egress', value: tel.blockedEgress ?? 0, color: (tel.blockedEgress ?? 0) > 0 ? '#EF4444' : '#6B7280' },
    { icon: Cpu, label: 'Local Model Calls', value: tel.localModelCalls ?? 0, color: '#10B981' },
    { icon: Database, label: 'Local RAG Queries', value: tel.localRagQueries ?? 0, color: '#3B82F6' },
    { icon: HardDrive, label: 'Local DB Calls', value: tel.localDbCalls ?? 0, color: '#3B82F6' },
    { icon: CircleDot, label: 'Probes', value: Array.isArray(tel.probes) ? tel.probes.length : (tel.probes ?? 0), color: '#3B82F6' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} style={{ color: '#3B82F6' }} />
            <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-heading)' }}>System Monitoring</h1>
          </div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Real-time health and telemetry for all sovereign workbench services.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {polling && (
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>refreshing…</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading && !polling}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
          >
            <RefreshCw size={13} className={(loading || polling) ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Service Health Grid */}
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-heading)' }}>Service Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {serviceCards.map((svc) => (
            <ServiceCard key={svc.name} {...svc} />
          ))}
        </div>
      </div>

      {/* Telemetry Metrics */}
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-heading)' }}>Telemetry</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {metrics.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>
      </div>

      {/* Agent Limits */}
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-heading)' }}>Agent Limits</h2>
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-xl border p-4 flex items-center gap-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <GaugeCircle size={17} style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <div className="text-xl font-bold font-mono leading-none" style={{ color: 'var(--text-heading)' }}>
                {agent.maxToolCalls ?? '—'}
              </div>
              <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Max Tool Calls</div>
            </div>
          </div>
          <div
            className="rounded-xl border p-4 flex items-center gap-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.12)' }}>
              <FileText size={17} style={{ color: '#3B82F6' }} />
            </div>
            <div>
              <div className="text-xl font-bold font-mono leading-none" style={{ color: 'var(--text-heading)' }}>
                {agent.maxCodeExecutions ?? '—'}
              </div>
              <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Max Code Executions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Profile Banner */}
      <div
        className="rounded-xl border p-5 font-mono text-[13px]"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Server size={16} style={{ color: '#3B82F6' }} />
          <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>Hardware Profile</h3>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {hw.cpu && (
            <span style={{ color: 'var(--text-secondary)' }}>
              CPU: <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{hw.cpu}</span>
            </span>
          )}
          {hw.platform && (
            <>
              <span className="text-muted">|</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Platform: <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{hw.platform}</span>
              </span>
            </>
          )}
          {hw.ram && (
            <>
              <span className="text-muted">|</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                RAM: <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{hw.ram}</span>
              </span>
            </>
          )}
          <span className="text-muted">|</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Storage: <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{storage.backend || '—'}</span>
          </span>
          {storage.sqlite && (
            <>
              <span className="text-muted">|</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                SQLite: <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{storage.sqlite}</span>
              </span>
            </>
          )}
          <span className="text-muted">|</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Uptime: <span className="font-semibold" style={{ color: '#10B981' }}>{formatUptime(tel.uptimeSec)}</span>
          </span>
        </div>
      </div>

      {/* Recent Audit Stream */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>Recent Audit Activity</h2>
          <a
            href="/workbench/audit"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors"
            style={{ color: '#3B82F6' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <ScrollText size={13} />
            View full audit log
          </a>
        </div>
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Timestamp</th>
                  <th className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Action</th>
                  <th className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Severity</th>
                  <th className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>User</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      No audit entries yet.
                    </td>
                  </tr>
                ) : auditEntries.map((e, i) => (
                  <tr
                    key={e.id || e.seq || i}
                    className="border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-heading)' }}>
                      {e.action || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <SevBadge severity={e.severity} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {e.userEmail || e.userId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-[11px] pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        Monitoring data refreshed every {POLL_INTERVAL_MS / 1000}s. Telemetry captured at the process boundary.
      </div>
    </div>
  );
}
