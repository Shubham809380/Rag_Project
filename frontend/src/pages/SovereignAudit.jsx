import { useEffect, useState } from 'react';
import { Fingerprint, AlertTriangle } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { getSovereignAudit } from '../services/sovereign';

const SEV_COLOR = { info: '#3B82F6', warning: '#F59E0B', critical: '#EF4444' };

export default function SovereignAudit() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await getSovereignAudit({ limit: 200 });
        setData(d);
      } catch (e) { setError(e?.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <AppLayout title="Sovereign Audit"><div className="p-8 text-fg-muted">Loading…</div></AppLayout>;
  if (error) return <AppLayout title="Sovereign Audit"><div className="p-8 text-error">{error}</div></AppLayout>;

  const entries = data?.entries || [];
  const chain = data?.chainVerified || {};

  return (
    <AppLayout title="Sovereign Audit Log">
      <div className="p-6 space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-heading">Tamper-evident audit trail</h2>
            <p className="text-[13px] text-fg-muted">Every tool call, model invocation, approval and network event is chained with a running hash (SQLite + JSONL mirror).</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
              style={{ color: chain.intact ? '#10B981' : '#EF4444', background: chain.intact ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
              <Fingerprint size={14} /> {chain.intact ? 'hash chain intact' : 'CHAIN BROKEN'} · {chain.count ?? entries.length} entries
            </span>
          </div>
        </div>

        {!chain.intact && (
          <div className="flex items-center gap-2 text-error text-sm"><AlertTriangle size={16} /> The audit chain failed verification!</div>
        )}

        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: 'var(--bg-card)' }}>
              <tr className="text-left text-fg-muted">
                <th className="px-4 py-2">Time</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Severity</th><th className="px-4 py-2">User</th><th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-t align-top" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-2 text-fg-muted whitespace-nowrap">{new Date(e.timestamp || e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-fg">{e.category}</td>
                  <td className="px-4 py-2 font-medium text-heading">{e.action}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ color: SEV_COLOR[e.severity] || '#3B82F6', background: `${SEV_COLOR[e.severity] || '#3B82F6'}22` }}>{e.severity}</span>
                  </td>
                  <td className="px-4 py-2 text-fg-muted">{e.userEmail || e.userId || '—'}</td>
                  <td className="px-4 py-2 text-fg-muted max-w-[320px] break-words">
                    {e.details ? <code className="text-[11px]">{JSON.stringify(e.details).slice(0, 160)}</code> : '—'}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-fg-muted">No audit entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}