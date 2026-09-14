import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ShieldCheck, Wifi, CloudOff, Database, Box, XCircle, Activity, Eye,
  Radio, HardDrive, LoaderCircle as Loader2,
} from 'lucide-react';

const api = axios.create({ baseURL: '/api', timeout: 30000, withCredentials: true });

function StatusCard({ icon: Icon, value, label, description, color }) {
  return (
    <div className="rounded-xl border p-4 flex items-start gap-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold font-mono leading-none" style={{ color }}>{value}</div>
        <div className="text-[13px] font-semibold text-heading mt-1">{label}</div>
        {description && <div className="text-[11px] text-muted mt-0.5">{description}</div>}
      </div>
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

function EventRow({ ev }) {
  const typeMap = {
    egress_block: { color: '#EF4444', label: 'BLOCKED' },
    egress_attempt: { color: '#F59E0B', label: 'ATTEMPT' },
    probe: { color: '#3B82F6', label: 'PROBE' },
    local_model: { color: '#10B981', label: 'LOCAL MODEL' },
  };
  const t = typeMap[ev.eventType] || { color: '#6B7280', label: ev.eventType };
  return (
    <tr className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
      <td className="px-3 py-2 font-mono text-muted whitespace-nowrap text-[11px]">
        {new Date(ev.at).toLocaleString()}
      </td>
      <td className="px-3 py-2">
        <Badge color={t.color}>{t.label}</Badge>
      </td>
      <td className="px-3 py-2 font-mono text-muted text-[11px] max-w-[180px] truncate">{ev.destination || '—'}</td>
      <td className="px-3 py-2 text-muted text-[11px]">{ev.provider || '—'}</td>
      <td className="px-3 py-2">
        <Badge color={ev.success ? '#10B981' : '#EF4444'}>{ev.success ? 'OK' : 'DENIED'}</Badge>
      </td>
    </tr>
  );
}

function ServiceCard({ svc }) {
  return (
    <div className="rounded-lg border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-semibold text-heading">{svc.name}</span>
        <Badge color="#10B981">LOCAL</Badge>
      </div>
      <div className="font-mono text-[11px] text-muted truncate">{svc.endpoint}</div>
      <div className="text-[10px] text-muted mt-1 uppercase tracking-wide">{svc.kind}</div>
    </div>
  );
}

export default function SovereignSovereignty() {
  const [status, setStatus] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, d] = await Promise.all([
          api.get('/sovereign/status').then(r => r.data),
          api.get('/sovereign/dashboard').then(r => r.data),
        ]);
        if (!active) return;
        setStatus(s);
        setDashboard(d);
      } catch (e) {
        setError(e?.response?.data?.error || e?.message || 'Failed to load sovereignty data');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3 text-muted py-20 justify-center">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading sovereignty status…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="rounded-xl border p-6 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  const egress = status?.egress || 'deny';
  const isBlocked = egress === 'deny' || egress === 'block';
  const internet = status?.internetConnected === true;
  const tel = status?.telemetry || {};
  const services = status?.localServices || [];
  const events = (dashboard?.egressEvents || []).slice(0, 12);
  const hw = status?.hardwareProfile || {};
  const counts = status?.counts || {};

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-heading" style={{ color: 'var(--text-heading)' }}>Sovereignty Center</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Zero cloud dependencies. Everything runs inside the plant network.</p>
      </div>

      {/* Hero banner */}
      <div className="rounded-xl border p-5 font-mono text-[13px]" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10B981' }} />
              <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: '#10B981' }} />
            </span>
            <span className="text-[15px] font-bold tracking-wide" style={{ color: '#10B981' }}>SOVEREIGN MODE ACTIVE</span>
          </div>
          <span className="text-muted">|</span>
          <span style={{ color: 'var(--text-secondary)' }}>mode: <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{status?.mode || 'local'}</span></span>
          <span className="text-muted">|</span>
          <span style={{ color: 'var(--text-secondary)' }}>egress: <span className="font-semibold" style={{ color: isBlocked ? '#EF4444' : '#F59E0B' }}>{egress}</span></span>
          <span className="text-muted">|</span>
          <span style={{ color: 'var(--text-secondary)' }}>hardware: <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{hw.platform || hw.cpu || '—'}</span></span>
          {hw.ram && (
            <>
              <span className="text-muted">|</span>
              <span style={{ color: 'var(--text-secondary)' }}>ram: <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{hw.ram}</span></span>
            </>
          )}
        </div>
      </div>

      {/* 5 status cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatusCard
          icon={internet ? Wifi : CloudOff}
          value={internet ? 'ONLINE' : 'BLOCKED'}
          label="Internet"
          description={internet ? 'External connectivity detected' : 'No external connectivity'}
          color={isBlocked ? '#EF4444' : internet ? '#F59E0B' : '#10B981'}
        />
        <StatusCard
          icon={Radio}
          value={tel.externalApiCalls ?? 0}
          label="External API Calls"
          description="Detected external HTTP calls"
          color={tel.externalApiCalls > 0 ? '#F59E0B' : '#6B7280'}
        />
        <StatusCard
          icon={XCircle}
          value={tel.blockedEgress ?? 0}
          label="Blocked Attempts"
          description="Egress attempts denied by monitor"
          color={tel.blockedEgress > 0 ? '#EF4444' : '#6B7280'}
        />
        <StatusCard
          icon={Activity}
          value={tel.totalEgressAttempts ?? 0}
          label="Egress Attempts"
          description="Total outbound attempts observed"
          color={tel.totalEgressAttempts > 0 ? '#F59E0B' : '#6B7280'}
        />
        <StatusCard
          icon={CloudOff}
          value={tel.cloudModelCalls ?? 0}
          label="Cloud AI Calls"
          description="Calls to any cloud model provider"
          color={tel.cloudModelCalls > 0 ? '#EF4444' : '#6B7280'}
        />
      </div>

      {/* Local services */}
      <div>
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-heading)' }}>Local Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {services.map(svc => (
            <ServiceCard key={svc.name} svc={svc} />
          ))}
          {/* Count rows */}
          <div className="rounded-lg border p-3 flex items-center gap-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <Database size={18} style={{ color: '#3B82F6' }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>Local Vector DB</div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{counts.vectorDbCollections ?? counts.collections ?? '—'} collections</div>
            </div>
          </div>
          <div className="rounded-lg border p-3 flex items-center gap-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <HardDrive size={18} style={{ color: '#3B82F6' }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>Local DB</div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{counts.localDbEntries ?? '—'} entries</div>
            </div>
          </div>
          <div className="rounded-lg border p-3 flex items-center gap-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <Box size={18} style={{ color: status?.sandbox?.dockerAvailable ? '#10B981' : '#6B7280' }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>Sandbox</div>
              <div className="text-[11px] font-mono" style={{ color: status?.sandbox?.dockerAvailable ? '#10B981' : '#6B7280' }}>
                {status?.sandbox?.dockerAvailable ? 'Docker available' : status?.sandbox?.dockerConfigured ? 'Docker configured (unavailable)' : 'Not configured'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Monitor */}
      <div>
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-heading)' }}>Network Monitor</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left: network status */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={16} style={{ color: '#3B82F6' }} />
              <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>Network Status</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-[13px]">
                <span style={{ color: 'var(--text-muted)' }}>Internet</span>
                <Badge color={internet ? '#F59E0B' : '#10B981'}>{internet ? 'Connected' : 'Blocked'}</Badge>
              </div>
              <div className="flex justify-between text-[13px]">
                <span style={{ color: 'var(--text-muted)' }}>External Connections</span>
                <span className="font-mono font-semibold" style={{ color: 'var(--text-heading)' }}>{tel.externalApiCalls ?? 0}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span style={{ color: 'var(--text-muted)' }}>Blocked Attempts</span>
                <span className="font-mono font-semibold" style={{ color: tel.blockedEgress > 0 ? '#EF4444' : 'var(--text-heading)' }}>{tel.blockedEgress ?? 0}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span style={{ color: 'var(--text-muted)' }}>Egress Attempts</span>
                <span className="font-mono font-semibold" style={{ color: tel.totalEgressAttempts > 0 ? '#F59E0B' : 'var(--text-heading)' }}>{tel.totalEgressAttempts ?? 0}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span style={{ color: 'var(--text-muted)' }}>Egress Mode</span>
                <Badge color={isBlocked ? '#EF4444' : '#F59E0B'}>{egress}</Badge>
              </div>
              <div className="flex justify-between text-[13px]">
                <span style={{ color: 'var(--text-muted)' }}>Last Probe</span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {tel.probesDisabled ? 'Disabled — zero network probes; nothing leaves the machine' : (tel.probes?.length ? `${tel.probes.length} probe(s) recorded` : 'No probes yet')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: recent network events */}
          <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Eye size={16} style={{ color: '#3B82F6' }} />
                <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>Recent Network Events</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                    <th className="px-3 pb-2">Timestamp</th>
                    <th className="px-3 pb-2">Event</th>
                    <th className="px-3 pb-2">Destination</th>
                    <th className="px-3 pb-2">Provider</th>
                    <th className="px-3 pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No network events recorded yet.</td></tr>
                  ) : events.map((ev, i) => <EventRow key={i} ev={ev} />)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="text-[11px] pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        Telemetry is captured at the process boundary by the Sovereign Monitor. Counters reflect real captured events.
      </div>
    </div>
  );
}
