import { useEffect, useState, useMemo } from 'react';
import {
  ClipboardList,
  CircleCheck as CheckCircle,
  AlertTriangle,
  Filter,
  RefreshCw,
  Eye,
  ShieldAlert,
  LoaderCircle as Loader2,
} from 'lucide-react';
import { getSovereignAudit } from '../../services/sovereign';

const SEVERITY_STYLE = {
  info:     { color: '#64748B', bg: 'rgba(100,116,139,0.10)' },
  notice:   { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
};

const CATEGORY_STYLE = {
  auth:     { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  security: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
  model:    { color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
  tool:     { color: '#06B6D4', bg: 'rgba(6,182,212,0.10)' },
  agent:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  system:   { color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' },
};

const CATEGORIES = ['auth', 'security', 'model', 'tool', 'agent', 'system'];
const SEVERITIES = ['info', 'notice', 'warning', 'critical'];

function SeverityBadge({ severity }) {
  const s = SEVERITY_STYLE[severity] || SEVERITY_STYLE.info;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono uppercase"
      style={{ color: s.color, background: s.bg }}
    >
      {severity === 'critical' && <ShieldAlert size={10} />}
      {severity}
    </span>
  );
}

function CategoryBadge({ category }) {
  const s = CATEGORY_STYLE[category] || { color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.10)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      {category || '—'}
    </span>
  );
}

function ChainBadge({ intact, count }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
      style={{
        color: intact ? '#10B981' : '#EF4444',
        background: intact ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: intact ? '#10B981' : '#EF4444' }} />
      {intact ? 'hash chain intact' : 'CHAIN BROKEN'} · {count} entries
    </span>
  );
}

function DetailRow({ detail }) {
  const [expanded, setExpanded] = useState(false);
  const jsonStr = detail?.details ? JSON.stringify(detail.details, null, 2) : null;
  const truncated = detail?.details ? JSON.stringify(detail.details) : '';

  return (
    <>
      <tr
        className="transition-colors cursor-pointer"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover, rgba(255,255,255,0.02))'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <td className="px-4 py-2.5 font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
          {detail.timestamp ? new Date(detail.timestamp).toLocaleString() : '—'}
        </td>
        <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
          {detail.userEmail || detail.userId || '—'}
        </td>
        <td className="px-4 py-2.5">
          <CategoryBadge category={detail.category} />
        </td>
        <td className="px-4 py-2.5 text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
          {detail.action || '—'}
        </td>
        <td className="px-4 py-2.5">
          <SeverityBadge severity={detail.severity} />
        </td>
        <td className="px-4 py-2.5 max-w-[280px]">
          {truncated ? (
            <span className="font-mono text-[10px] truncate block" style={{ color: 'var(--text-muted)' }}>
              {expanded ? '' : truncated.slice(0, 100) + (truncated.length > 100 ? '…' : '')}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <td colSpan={6} className="px-4 py-3" style={{ background: 'var(--bg-base)' }}>
            <div className="space-y-2">
              {detail.sessionId && (
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  Session: {detail.sessionId}
                </div>
              )}
              {detail.ip && (
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  IP: {detail.ip}
                </div>
              )}
              {detail.userAgent && (
                <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }} title={detail.userAgent}>
                  UA: {detail.userAgent}
                </div>
              )}
              {jsonStr && (
                <div>
                  <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Details JSON</div>
                  <pre
                    className="rounded-lg border p-3 text-[10px] font-mono overflow-x-auto max-h-[200px] overflow-y-auto"
                    style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
                  >
                    {jsonStr}
                  </pre>
                </div>
              )}
              {detail.hash && (
                <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-semibold">Hash:</span>
                  <span className="break-all" style={{ color: 'var(--text-secondary)' }}>{detail.hash}</span>
                </div>
              )}
              {detail.prevHash && (
                <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-semibold">Prev:</span>
                  <span className="break-all" style={{ color: 'var(--text-secondary)' }}>{detail.prevHash}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SovereignAudit() {
  const [entries, setEntries] = useState([]);
  const [chainVerified, setChainVerified] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [appliedFilter, setAppliedFilter] = useState({ category: '', severity: '' });

  const fetchAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSovereignAudit({ limit: 200 });
      setEntries(data?.entries || []);
      setChainVerified(data?.chainVerified || null);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (appliedFilter.category && e.category !== appliedFilter.category) return false;
      if (appliedFilter.severity && e.severity !== appliedFilter.severity) return false;
      return true;
    });
  }, [entries, appliedFilter]);

  const handleApplyFilter = () => {
    setAppliedFilter({ category: filterCategory, severity: filterSeverity });
  };

  const hasActiveFilter = appliedFilter.category || appliedFilter.severity;

  if (loading && entries.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading audit trail…</span>
        </div>
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="text-[13px] rounded-xl border p-4" style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} style={{ color: '#3B82F6' }} />
            <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-heading)' }}>Audit Logs</h1>
          </div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Tamper-evident audit trail — every tool call, model invocation, approval and network event.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {chainVerified && <ChainBadge intact={chainVerified.intact} count={entries.length} />}
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Chain broken warning */}
      {chainVerified && !chainVerified.intact && (
        <div
          className="flex items-center gap-2 text-[12px] rounded-xl border p-3"
          style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}
        >
          <AlertTriangle size={14} />
          The audit chain failed verification — records may have been tampered with.
        </div>
      )}

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-3 p-3 rounded-xl border"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
      >
        <div className="flex items-center gap-1.5">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Filters</span>
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-lg border px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <option value="">All Severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          onClick={handleApplyFilter}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
          style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.08)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.16)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
        >
          <Eye size={12} />
          Apply
        </button>

        {hasActiveFilter && (
          <button
            onClick={() => { setFilterCategory(''); setFilterSeverity(''); setAppliedFilter({ category: '', severity: '' }); }}
            className="text-[11px] underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
          Showing {filteredEntries.length} of {entries.length}
        </span>
      </div>

      {/* Table */}
      {filteredEntries.length === 0 ? (
        <div
          className="rounded-xl border p-12 flex flex-col items-center justify-center gap-3 text-center"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <CheckCircle size={36} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>
            No audit entries recorded.
          </p>
          {hasActiveFilter && (
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Try adjusting your filter criteria.
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Timestamp</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>User</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Category</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Action</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Severity</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <DetailRow key={entry.id || entry.seq || Math.random()} detail={entry} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
