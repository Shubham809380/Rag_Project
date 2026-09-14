import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  LoaderCircle as Loader2,
  Lock,
  Shield,
  Wrench,
} from 'lucide-react';
import { getSovereignTools } from '../../services/sovereign';

const RISK_STYLE = {
  low:    { c: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  medium: { c: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  high:   { c: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

const PERM_COLOR = [null, '#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

const CODE_RE = /\b(code|coding|exec|execute|python|shell|command|sandbox|script)\b/i;

function isCodeTool(name) {
  return CODE_RE.test(name || '');
}

function RiskBadge({ level }) {
  const s = RISK_STYLE[level] || RISK_STYLE.low;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono uppercase whitespace-nowrap"
      style={{ color: s.c, background: s.bg }}
    >
      <AlertTriangle size={10} />
      {level || 'low'}
    </span>
  );
}

function PermBadge({ level }) {
  const n = Number(level);
  const c = PERM_COLOR[n] || '#6B7280';
  return (
    <span
      className="inline-flex items-center justify-center min-w-[26px] h-5 px-1 rounded-md font-mono text-[11px] font-bold"
      style={{ color: c, background: `${c}1a` }}
    >
      {Number.isFinite(n) ? n : '—'}
    </span>
  );
}

function fmtTimeout(ms) {
  if (ms == null) return '—';
  const n = Number(ms);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return `${Math.round(n / 1000)}s`;
  return `${n}ms`;
}

export default function SovereignTools() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await getSovereignTools();
        if (!active) return;
        setTools(d?.tools || []);
      } catch (e) {
        if (active) setError(e?.response?.data?.error || e?.message || 'Failed to load tool registry');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3 py-20 justify-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" />
          Loading tool registry…
        </div>
      </div>
    );
  }

  if (error && tools.length === 0) {
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

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <Wrench size={18} style={{ color: '#3B82F6' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Tool Manager</h1>
        </div>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Tools the sovereign agent may invoke, with permission, timeout and risk posture.
        </p>
      </div>

      {/* Network & sandbox summary strip */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} style={{ color: '#10B981' }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
            Network & Sandbox Policy
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-base)' }}>
            <Eye size={12} style={{ color: '#10B981' }} />
            All tool execution is audited.
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-base)' }}>
            <Lock size={12} style={{ color: '#EF4444' }} />
            Code runs in a Docker sandbox with network disabled.
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-base)' }}>
            <Shield size={12} style={{ color: '#3B82F6' }} />
            Spreadsheet formulas are never executed.
          </span>
        </div>
      </div>

      {/* Tools table */}
      {tools.length === 0 ? (
        <div
          className="rounded-xl border p-12 flex flex-col items-center justify-center gap-3 text-center"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <Wrench size={36} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>No tools registered</p>
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Tools will appear here once the sovereign agent catalog is configured.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Wrench size={16} style={{ color: '#3B82F6' }} />
              <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
                Tool Registry
              </h3>
              <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{tools.length} tools</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left" style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th className="px-4 py-3 font-semibold">Tool</th>
                  <th className="px-4 py-3 font-semibold">Version</th>
                  <th className="px-4 py-3 font-semibold">Permission Level</th>
                  <th className="px-4 py-3 font-semibold">Timeout</th>
                  <th className="px-4 py-3 font-semibold">Risk</th>
                  <th className="px-4 py-3 font-semibold">Network</th>
                  <th className="px-4 py-3 font-semibold">Security</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => {
                  const code = isCodeTool(t.name);
                  return (
                    <tr key={t.name || t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-[12px]" style={{ color: 'var(--text-heading)' }}>{t.name}</div>
                        <div className="text-[11px] max-w-[300px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {t.description || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t.version || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PermBadge level={t.permissionLevel} />
                          <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>
                            {t.permissionLevel != null ? `L${t.permissionLevel}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{fmtTimeout(t.timeoutMs)}</span>
                      </td>
                      <td className="px-4 py-3"><RiskBadge level={t.requiresApprovalRisk || t.approvalRisk} /></td>
                      <td className="px-4 py-3">
                        {code ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                            style={{ color: '#EF4444', background: 'rgba(239,68,68,0.12)' }}
                          >
                            <Lock size={10} /> Blocked
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                            style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.12)' }}
                          >
                            Internal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={code
                            ? { color: '#10B981', background: 'rgba(16,185,129,0.12)' }
                            : { color: '#3B82F6', background: 'rgba(59,130,246,0.12)' }}
                        >
                          <Shield size={10} />
                          {code ? 'Sandboxed' : 'Policy'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer note */}
      {tools.length > 0 && (
        <div className="text-[11px] pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
          Network and security posture is derived from the tool catalog. Execution boundaries are enforced by the sovereign sandbox.
        </div>
      )}
    </div>
  );
}