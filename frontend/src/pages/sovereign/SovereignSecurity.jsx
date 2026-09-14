import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ShieldCheck, Globe, XCircle, Lock, AlertTriangle, LoaderCircle as Loader2,
} from 'lucide-react';

const api = axios.create({ baseURL: '/api', timeout: 30000, withCredentials: true });

const SEV_COLOR = { info: '#3B82F6', warning: '#F59E0B', critical: '#EF4444' };

function MetricCard({ icon: Icon, value, label, description, color }) {
  return (
    <div className="rounded-xl border p-4 flex items-start gap-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold font-mono leading-none" style={{ color }}>{value}</div>
        <div className="text-[13px] font-semibold text-heading mt-1">{label}</div>
        {description && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</div>}
      </div>
    </div>
  );
}

function SevBadge({ severity }) {
  const c = SEV_COLOR[severity] || '#6B7280';
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: c, background: `${c}18` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {severity}
    </span>
  );
}

export default function SovereignSecurity() {
  const [status, setStatus] = useState(null);
  const [securityAudit, setSecurityAudit] = useState(null);
  const [networkAudit, setNetworkAudit] = useState(null);
  const [authAudit, setAuthAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, sec, net, auth] = await Promise.all([
          api.get('/sovereign/status').then(r => r.data),
          api.get('/sovereign/audit', { params: { category: 'security', limit: 50 } }).then(r => r.data),
          api.get('/sovereign/audit', { params: { category: 'network', limit: 30 } }).then(r => r.data),
          api.get('/sovereign/audit', { params: { category: 'auth', limit: 50 } }).then(r => r.data),
        ]);
        if (!active) return;
        setStatus(s);
        setSecurityAudit(sec);
        setNetworkAudit(net);
        setAuthAudit(auth);
      } catch (e) {
        setError(e?.response?.data?.error || e?.message || 'Failed to load security data');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3 py-20 justify-center" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" />
          <span>Loading security data…</span>
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

  const tel = status?.telemetry || {};
  const secEntries = securityAudit?.entries || [];
  const netEntries = networkAudit?.entries || [];
  const authEntries = authAudit?.entries || [];

  const secCritical = secEntries.filter(e => e.severity === 'critical').length;
  const secWarning = secEntries.filter(e => e.severity === 'warning').length;
  const secCount = secCritical + secWarning;

  const authFailures = authEntries.filter(e =>
    (e.action || '').match(/login|auth|credential/i) &&
    (e.severity === 'warning' || e.severity === 'critical')
  ).length;

  const toolDenials = [...secEntries, ...netEntries].filter(e =>
    e.action === 'tool_denied'
  ).length;

  const injectionCount = [...secEntries, ...netEntries, ...authEntries].filter(e => {
    const det = JSON.stringify(e.details || '').toLowerCase();
    const act = (e.action || '').toLowerCase();
    return det.includes('injection') || act.includes('prompt_guard') || act.includes('prompt injection');
  }).length;

  const isSecure = secCritical === 0;

  function describeEntry(e) {
    const d = e.details || {};
    if (d.destination) return `Network activity toward ${d.destination}`;
    if (d.url) return `Request to ${d.url}`;
    if (d.tool) return `Tool "${d.tool}" access event`;
    if (d.query) return `Query: "${String(d.query).slice(0, 60)}"`;
    if (d.endpoint) return `Endpoint ${d.endpoint}`;
    if (d.reason) return d.reason;
    if (e.action === 'tool_denied') return `Tool call denied by policy`;
    if (e.action === 'prompt_guard') return `Prompt injection guard triggered`;
    return e.action || '—';
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Security Center</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Security posture and hardening events for the sovereign workbench.</p>
      </div>

      {/* Health strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Health score card */}
        <div className="rounded-xl border p-5 flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: isSecure ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
            <ShieldCheck size={28} style={{ color: isSecure ? '#10B981' : '#EF4444' }} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Security Health</div>
            <div className="text-xl font-bold" style={{ color: isSecure ? '#10B981' : '#EF4444' }}>
              {isSecure ? 'SECURE' : `${secCritical} CRITICAL`}
            </div>
            {!isSecure && (
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {secWarning} warning{secWarning !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        <MetricCard
          icon={AlertTriangle}
          value={secCount}
          label="Security Events"
          description="Critical + warning events"
          color={secCount > 0 ? '#F59E0B' : '#6B7280'}
        />
        <MetricCard
          icon={XCircle}
          value={tel.blockedEgress ?? 0}
          label="Blocked Network Requests"
          description="Egress attempts denied"
          color={(tel.blockedEgress ?? 0) > 0 ? '#EF4444' : '#6B7280'}
        />
        <MetricCard
          icon={Lock}
          value={authFailures}
          label="Authentication Failures"
          description="Login/auth warnings"
          color={authFailures > 0 ? '#EF4444' : '#6B7280'}
        />
        <MetricCard
          icon={ShieldCheck}
          value={toolDenials}
          label="Tool Permission Denials"
          description="Tool calls blocked by policy"
          color={toolDenials > 0 ? '#F59E0B' : '#6B7280'}
        />
      </div>

      {/* Security Events table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: '#F59E0B' }} />
            <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>Security Events</h3>
            <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{secEntries.length} events</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                <th className="px-4 pb-2">Timestamp</th>
                <th className="px-4 pb-2">Severity</th>
                <th className="px-4 pb-2">Action</th>
                <th className="px-4 pb-2">Event</th>
                <th className="px-4 pb-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {secEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No security events recorded. System is operating normally.
                  </td>
                </tr>
              ) : secEntries.map((e, i) => (
                <tr key={e.id || i} className="border-t align-top" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-2 whitespace-nowrap font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2"><SevBadge severity={e.severity} /></td>
                  <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-heading)' }}>{e.action}</td>
                  <td className="px-4 py-2 max-w-[260px]" style={{ color: 'var(--text-muted)' }}>{describeEntry(e)}</td>
                  <td className="px-4 py-2 max-w-[200px]">
                    <code className="text-[10px] break-words" style={{ color: 'var(--text-muted)' }}>
                      {e.details ? JSON.stringify(e.details).slice(0, 120) : '—'}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-column: Network blocks + Prompt injection */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Network Blocks table — 2 cols */}
        <div className="md:col-span-2 rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Globe size={16} style={{ color: '#EF4444' }} />
              <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>Network Blocks</h3>
              <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{netEntries.length} entries</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-4 pb-2">Timestamp</th>
                  <th className="px-4 pb-2">Event</th>
                  <th className="px-4 pb-2">Destination</th>
                  <th className="px-4 pb-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {netEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      No network block events recorded.
                    </td>
                  </tr>
                ) : netEntries.map((e, i) => (
                  <tr key={e.id || i} className="border-t align-top" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-4 py-2 whitespace-nowrap font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-heading)' }}>{e.action}</td>
                    <td className="px-4 py-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {e.details?.destination || e.details?.url || '—'}
                    </td>
                    <td className="px-4 py-2 max-w-[220px]">
                      <code className="text-[10px] break-words" style={{ color: 'var(--text-muted)' }}>
                        {e.details ? JSON.stringify(e.details).slice(0, 140) : '—'}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prompt Injection card — 1 col */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} style={{ color: injectionCount > 0 ? '#EF4444' : '#10B981' }} />
            <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>Prompt Injection</h3>
          </div>
          <div className="text-3xl font-bold font-mono mb-2" style={{ color: injectionCount > 0 ? '#EF4444' : '#6B7280' }}>
            {injectionCount}
          </div>
          {injectionCount === 0 ? (
            <div className="flex items-center gap-2 rounded-lg p-3 mt-2" style={{ background: 'rgba(107,114,128,0.08)' }}>
              <ShieldCheck size={14} style={{ color: '#6B7280' }} />
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No injection attempts detected</span>
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              {[...secEntries, ...netEntries, ...authEntries]
                .filter(e => {
                  const det = JSON.stringify(e.details || '').toLowerCase();
                  const act = (e.action || '').toLowerCase();
                  return det.includes('injection') || act.includes('prompt_guard') || act.includes('prompt injection');
                })
                .slice(0, 5)
                .map((e, i) => (
                  <div key={e.id || i} className="flex items-start gap-2 text-[11px] py-1.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
                    <div>
                      <div className="font-mono" style={{ color: 'var(--text-muted)' }}>{new Date(e.timestamp).toLocaleString()}</div>
                      <div className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>{describeEntry(e)}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <div className="text-[11px] pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        Security data sourced from the sovereign audit chain and process-boundary telemetry. All counts reflect captured events.
      </div>
    </div>
  );
}
