import { useEffect, useState } from 'react';
import {
  ChartColumn as BarChart3,
  Cpu,
  Database,
  HardDrive,
  LoaderCircle as Loader2,
  RefreshCw,
  Waypoints,
} from 'lucide-react';
import { getSovereignModels } from '../../services/sovereign';

const STATUS_STYLE = {
  available:   { c: '#10B981', label: 'Available' },
  configured:  { c: '#F59E0B', label: 'Configured' },
  unavailable: { c: '#EF4444', label: 'Unavailable' },
};

const ROLE_COLOR = {
  vision:    '#3B82F6',
  coding:    '#10B981',
  reasoning: '#F59E0B',
};

const ROUTER_EXPLAIN = [
  { trigger: 'Image Analysis', target: 'Local Vision Model', role: 'vision' },
  { trigger: 'Python Coding', target: 'Local Coding Model', role: 'coding' },
  { trigger: 'Q&A / RAG', target: 'Local Reasoning Model', role: 'reasoning' },
];

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { c: '#6B7280', label: status || 'Unknown' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: s.c, background: `${s.c}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.c }} />
      {s.label}
    </span>
  );
}

function RoleBadge({ role }) {
  const c = ROLE_COLOR[role] || '#6B7280';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono uppercase whitespace-nowrap"
      style={{ color: c, background: `${c}1a` }}
    >
      {role || '—'}
    </span>
  );
}

function fmtOpenAi(v) {
  if (v == null) return '—';
  if (typeof v === 'object') {
    const bits = [];
    if (v.endpoint) bits.push(v.endpoint);
    if (v.baseUrl) bits.push(v.baseUrl);
    if (v.enabled != null) bits.push(v.enabled ? 'enabled' : 'disabled');
    if (bits.length) return bits.join(' · ');
    return JSON.stringify(v).slice(0, 80);
  }
  return v ? 'Enabled' : 'Disabled';
}

function fmtHardware(hw) {
  if (!hw) return '—';
  if (typeof hw === 'string') return hw;
  const bits = [hw.platform, hw.cpu, hw.gpu, hw.ram && `ram ${hw.ram}`].filter(Boolean);
  return bits.join(' · ') || JSON.stringify(hw).slice(0, 80);
}

function RouterItem({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}1f` }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
          {label}
        </div>
        <div className="font-mono text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function SovereignModels() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchModels = async () => {
    setRefreshing(true);
    setError('');
    try {
      const d = await getSovereignModels();
      setData(d);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load model registry');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchModels(); }, []);

  if (!data && !error) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3 py-20 justify-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" />
          Loading model registry…
        </div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div
          className="rounded-xl border p-6 text-center text-[13px]"
          style={{ background: 'var(--bg-card)', borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444' }}
        >
          {error}
        </div>
      </div>
    );
  }

  const models = data?.models || [];
  const router = data?.router || {};
  const available = models.filter((m) => m.status === 'available').length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} style={{ color: '#3B82F6' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Model Manager</h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.12)' }}
            >
              Router: {router.mode || 'local'}
            </span>
          </div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Registry of local models exposed to the sovereign router. All inference stays on-premise.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] max-w-[280px] truncate hidden lg:block" style={{ color: 'var(--text-muted)' }}>
            gateway: {router.gateway || '—'}
          </span>
          <button
            onClick={fetchModels}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Router decision strip */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Waypoints size={14} style={{ color: '#3B82F6' }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
            Router Decision Context
          </h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <RouterItem icon={Cpu} label="Mode" value={router.mode || 'local'} color="#3B82F6" />
          <RouterItem icon={Waypoints} label="Gateway" value={router.gateway || '—'} color="#10B981" />
          <RouterItem icon={BarChart3} label="OpenAI Compatible" value={fmtOpenAi(router.openaiCompat)} color="#F59E0B" />
          <RouterItem icon={HardDrive} label="Hardware Profile" value={fmtHardware(router.hardwareProfile)} color="#6B7280" />
        </div>
      </div>

      {/* Models table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <HardDrive size={16} style={{ color: '#3B82F6' }} />
          <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
            Registered Models
          </h3>
          <span
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ color: '#10B981', background: 'rgba(16,185,129,0.12)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
            {available} / {models.length} available
          </span>
        </div>
        {models.length === 0 ? (
          <div className="px-5 pb-10 pt-4 flex flex-col items-center gap-2 text-center">
            <Database size={30} style={{ color: 'var(--text-muted)' }} />
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>No models registered</p>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Configure a local model to enable sovereign inference.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left" style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Provider</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">VRAM</th>
                  <th className="px-4 py-3 font-semibold">Profile</th>
                  <th className="px-4 py-3 font-semibold">Capabilities</th>
                  <th className="px-4 py-3 font-semibold">Id / Key</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id || m.modelKey} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text-heading)' }}>{m.name}</div>
                      {m.modelId && <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.modelId}</div>}
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                    <td className="px-4 py-3">
                      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{m.provider || '—'}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {m.vramGb != null ? `${m.vramGb} GB` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{m.profile || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {m.capabilities?.length ? (
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {m.capabilities.map((cap) => (
                            <span key={cap} className="px-1.5 py-0.5 rounded font-mono text-[10px] whitespace-nowrap"
                              style={{ color: 'var(--text-secondary)', background: 'var(--bg-base)' }}>
                              {cap}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{m.id || '—'}</div>
                      <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.modelKey || ''}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Router selection explainer (educational) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Waypoints size={16} style={{ color: '#F59E0B' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>Why {`${(router.mode || 'local')}`} Models Get Selected</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ROUTER_EXPLAIN.map((item) => (
            <div key={item.role} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
              <div className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>{item.trigger}</div>
              <div className="font-mono text-[15px] my-1.5" style={{ color: '#3B82F6' }}>→</div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>{item.target}</div>
              <div className="mt-2"><RoleBadge role={item.role} /></div>
              <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Requests of this type are routed to the local model tagged with this role when its status is available.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="text-[11px] pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        Model status comes from the live registry. The router selector above is an educational summary of the routing policy (tier 1 → role → status → jump to next candidate).
      </div>
    </div>
  );
}