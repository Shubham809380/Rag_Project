import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Airplay, Cpu, Database, FileText, GitBranch, Server, Shield, Boxes, Fingerprint } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { getSovereignStatus, getSovereignDashboard } from '../services/sovereign';

function Card({ title, children, icon: Icon, tone = 'blue' }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={18} style={{ color: tone === 'amber' ? '#F59E0B' : '#3B82F6' }} />}
        <h3 className="text-[13px] font-semibold text-heading">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Badge({ ok, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: ok ? '#10B981' : '#EF4444' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? '#10B981' : '#EF4444' }} />
      {label}
    </span>
  );
}

export default function SovereignDashboard() {
  const [status, setStatus] = useState(null);
  const [dash, setDash] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [s, d] = await Promise.all([getSovereignStatus(), getSovereignDashboard()]);
        if (!on) return;
        setStatus(s); setDash(d);
      } catch (e) {
        setError(e?.response?.data?.error || e?.message || 'Failed to load sovereign status');
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, []);

  if (loading) return <AppLayout title="Sovereign Workbench"><div className="p-8 text-fg-muted">Loading sovereign status…</div></AppLayout>;
  if (error) return <AppLayout title="Sovereign Workbench"><div className="p-8 text-error">{error}</div></AppLayout>;

  const egress = status?.egress;
  const models = status?.models || [];
  const availCount = models.filter(m => m.status === 'available').length;
  const counts = dash?.stats || status?.counts || {};
  const pending = dash?.pendingApprovals?.length || 0;

  return (
    <AppLayout title="Sovereign Workbench">
      <div className="p-6 space-y-6 max-w-7xl">
        {/* Header strip */}
        <div className="rounded-2xl p-6 text-white flex flex-wrap items-center justify-between gap-4"
          style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Airplay size={18} />
              <h2 className="text-lg font-bold">Sovereign AI Workbench</h2>
            </div>
            <p className="text-[13px] text-slate-300">
              Air-gapped agentic workbench layered on InsightRAG — local models, local RAG, local OCR/vision, approved human-in-the-loop workflow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge ok={status?.mode === 'local'} label={`mode: ${status?.mode}`} />
            <Badge ok={egress !== 'deny'} label={`egress: ${egress || 'n/a'}`} />
            <Badge ok={status?.internetConnected === false} label={status?.internetConnected ? 'online' : 'isolated'} />
          </div>
        </div>

        {error && <div className="text-error text-sm">{error}</div>}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card title="Collections" icon={Database}><div className="text-2xl font-bold text-heading">{counts.collections ?? dash?.collections?.length ?? 0}</div></Card>
          <Card title="Documents" icon={FileText}><div className="text-2xl font-bold text-heading">{counts.documents ?? dash?.documents?.length ?? 0}</div></Card>
          <Card title="Pending approvals" icon={Shield} tone="amber"><div className="text-2xl font-bold text-amber-500">{pending}</div></Card>
          <Card title="Models available" icon={Cpu}><div className="text-2xl font-bold text-heading">{availCount}/{models.length}</div></Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Local services" icon={Server}>
            <div className="space-y-2">
              {(status?.localServices || []).map(s => (
                <div key={s.name} className="flex items-center justify-between text-[13px]">
                  <span className="text-fg">{s.name}</span>
                  <Badge ok={s.kind?.startsWith('local')} label={s.kind} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Sovereignty counters (live telemetry)" icon={Activity} tone="emerald">
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div><div className="text-fg-muted">External AI calls</div><div className="font-bold text-heading">{status?.telemetry?.cloudModelCalls ?? 0}</div></div>
              <div><div className="text-fg-muted">External API calls</div><div className="font-bold text-heading">{status?.telemetry?.externalApiCalls ?? 0}</div></div>
              <div><div className="text-fg-muted">Blocked egress (denied)</div><div className="font-bold text-heading">{status?.telemetry?.blockedEgress ?? 0}</div></div>
              <div><div className="text-fg-muted">Cloud OCR / Embedding</div><div className="font-bold text-heading">0 / {status?.telemetry?.cloudEmbeddingCalls ?? 0}</div></div>
              <div><div className="text-fg-muted">Local model calls</div><div className="font-bold text-heading">{status?.telemetry?.localModelCalls ?? 0}</div></div>
              <div><div className="text-fg-muted">Local RAG queries</div><div className="font-bold text-heading">{status?.telemetry?.localRagQueries ?? 0}</div></div>
              <div><div className="text-fg-muted">Local tool executions</div><div className="font-bold text-heading">{status?.telemetry?.localToolExecutions ?? 0}</div></div>
              <div><div className="text-fg-muted">Local DB calls</div><div className="font-bold text-heading">{status?.telemetry?.localDbCalls ?? 0}</div></div>
            </div>
            <div className="mt-3 text-[12px] text-fg-muted">
              Egress mode: <Badge ok={egress !== 'deny'} label={egress || 'n/a'} />
              {status?.probes && <span className="ml-2">probe: <Badge ok={!status.internetConnected} label={status.internetConnected ? 'connected' : 'isolated'} /></span>}
              <div className="mt-1.5 text-fg-muted/70">Cloud OCR/embedding are structurally 0 — no cloud provider exists in this domain; attempts would be counted in blocked egress.</div>
            </div>
          </Card>

          <Card title="Local models" icon={Cpu}>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {models.slice().reverse().map(m => (
                <div key={m.key} className="flex items-center justify-between text-[13px]">
                  <span className="font-mono text-fg">{status?.telemetry ? m.modelId || m.key : m.key}</span>
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="text-fg-muted">{m.role}</span>
                    <Badge ok={m.status === 'available'} label={m.status} />
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Agent workflow gates" icon={GitBranch}>
            <div className="text-[13px] space-y-2">
              <div className="flex justify-between"><span className="text-fg-muted">Approval risk classes</span><span className="text-heading font-semibold">{status?.approvals?.mandatory?.length}</span></div>
              <div className="flex justify-between"><span className="text-fg-muted">Review-recommended classes</span><span className="text-heading font-semibold">{status?.approvals?.reviewRecommended?.length}</span></div>
              <div className="text-[12px] text-fg-muted mt-1">Tool calls limited to {status?.agent?.maxToolCalls} per task; {status?.agent?.maxCodeExecutions} code executions max.</div>
            </div>
          </Card>
        </div>

        {/* Recent tasks */}
        <Card title="Recent agent tasks" icon={Boxes}>
          {(!dash?.tasks || dash.tasks.length === 0) ? (
            <div className="text-fg-muted text-sm">No tasks yet. Go to the <Link className="text-blue-400 underline" to="/workbench/agent">Agent Workbench</Link>.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-fg-muted">
                  <th className="pb-2">Title</th><th className="pb-2">Type</th><th className="pb-2">Status</th><th className="pb-2">Approval</th><th className="pb-2">Created</th>
                </tr></thead>
                <tbody>
                  {dash.tasks.slice(0, 8).map(t => (
                    <tr key={t.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="py-2 pr-3 text-fg max-w-[240px] truncate">{t.title}</td>
                      <td className="py-2 pr-3 text-fg-muted">{t.taskType}</td>
                      <td className="py-2 pr-3"><Badge ok={t.status === 'completed'} label={t.status} /></td>
                      <td className="py-2 pr-3 text-fg-muted">{t.approvalStatus}</td>
                      <td className="py-2 text-fg-muted">{new Date(t.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Audit chain */}
        <Card title="Audit integrity" icon={Fingerprint}>
          <div className="flex items-center gap-3 text-sm">
            <Badge ok={dash?.chainVerified?.intact} label={dash?.chainVerified?.intact ? 'hash chain intact' : 'chain modified!'} />
            <span className="text-fg-muted">{dash?.auditEntries?.length} recent entries</span>
            <Link className="text-blue-400 underline" to="/workbench/audit">View audit log →</Link>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}