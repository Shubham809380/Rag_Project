import { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Package,
  LoaderCircle as Loader2,
} from 'lucide-react';
import { getSovereignArtifacts, sovereignArtifactUrl } from '../../services/sovereign';

const TYPE_META = {
  docx:  { label: 'Word',     color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  icon: FileText },
  xlsx:  { label: 'Excel',    color: '#10B981', bg: 'rgba(16,185,129,0.12)',  icon: FileSpreadsheet },
  pptx:  { label: 'PowerPoint', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: FileText },
  pdf:   { label: 'PDF',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   icon: FileText },
  py:    { label: 'Code',     color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  icon: FileCode },
  code:  { label: 'Code',     color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  icon: FileCode },
};

const CODE_TYPES = new Set(['py', 'js', 'ts', 'sh', 'code']);

function getTypeMeta(type) {
  if (!type) return { label: 'Other', color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: Package };
  const t = type.toLowerCase().replace('.', '');
  if (CODE_TYPES.has(t)) return TYPE_META.code;
  return TYPE_META[t] || { label: type.toUpperCase(), color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: Package };
}

function formatBytes(bytes) {
  if (bytes == null || bytes === undefined) return '—';
  const kb = bytes / 1024;
  if (kb > 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(1)} KB`;
}

function TypeBadge({ type }) {
  const meta = getTypeMeta(type);
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: meta.color, background: meta.bg }}
    >
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

const FILTER_TABS = [
  { key: 'all',   label: 'All' },
  { key: 'docx',  label: 'Word' },
  { key: 'xlsx',  label: 'Excel' },
  { key: 'pptx',  label: 'PowerPoint' },
  { key: 'pdf',   label: 'PDF' },
  { key: 'code',  label: 'Code' },
];

function matchesFilter(artifact, filter) {
  if (filter === 'all') return true;
  const t = (artifact.type || '').toLowerCase().replace('.', '');
  if (filter === 'code') return CODE_TYPES.has(t);
  return t === filter;
}

export default function SovereignDeliverables() {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchArtifacts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSovereignArtifacts();
      setArtifacts(data?.artifacts || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load deliverables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArtifacts(); }, []);

  const filtered = useMemo(() => artifacts.filter(a => matchesFilter(a, activeFilter)), [artifacts, activeFilter]);

  const typeCounts = useMemo(() => {
    const counts = { docx: 0, xlsx: 0, pptx: 0, pdf: 0, code: 0, other: 0 };
    for (const a of artifacts) {
      const t = (a.type || '').toLowerCase().replace('.', '');
      if (CODE_TYPES.has(t)) counts.code++;
      else if (counts[t] !== undefined) counts[t]++;
      else counts.other++;
    }
    return counts;
  }, [artifacts]);

  if (loading && artifacts.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3 py-20 justify-center" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" />
          <span>Loading deliverables…</span>
        </div>
      </div>
    );
  }

  if (error && artifacts.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="rounded-xl border p-6 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="text-red-400 text-sm">{error}</div>
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
            <Package size={18} style={{ color: '#3B82F6' }} />
            <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-heading)' }}>Generated Deliverables</h1>
          </div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Business documents produced by the AI workbench — Word, Excel, PowerPoint, PDF, Code.
          </p>
        </div>
      </div>

      {/* Summary Strip */}
      <div
        className="rounded-xl border p-4 flex flex-wrap items-center gap-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <Package size={18} style={{ color: '#3B82F6' }} />
          <div>
            <div className="text-xl font-bold font-mono leading-none" style={{ color: 'var(--text-heading)' }}>{artifacts.length}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Total Deliverables</div>
          </div>
        </div>
        <div className="h-8 w-px" style={{ background: 'var(--border-subtle)' }} />
        {[
          { label: 'Word', count: typeCounts.docx, color: '#3B82F6' },
          { label: 'Excel', count: typeCounts.xlsx, color: '#10B981' },
          { label: 'PowerPoint', count: typeCounts.pptx, color: '#F59E0B' },
          { label: 'PDF', count: typeCounts.pdf, color: '#EF4444' },
          { label: 'Code', count: typeCounts.code, color: '#8B5CF6' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
            <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            <span className="font-mono text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>{item.count}</span>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div
        className="flex flex-wrap items-center gap-1 p-1 rounded-xl border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{
              color: activeFilter === tab.key ? 'var(--text-heading)' : 'var(--text-muted)',
              background: activeFilter === tab.key ? 'var(--bg-base)' : 'transparent',
            }}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-1 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {tab.key === 'code' ? typeCounts.code : (typeCounts[tab.key] || 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Artifacts Table */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-12 flex flex-col items-center justify-center gap-3 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <Package size={36} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>
            {artifacts.length === 0
              ? 'No deliverables generated yet.'
              : `No ${activeFilter === 'all' ? '' : FILTER_TABS.find(f => f.key === activeFilter)?.label + ' '}deliverables found.`}
          </p>
          {artifacts.length === 0 && (
            <p className="text-[12px] max-w-[400px]" style={{ color: 'var(--text-muted)' }}>
              Run a task in the AI Workbench that produces Word, Excel or PowerPoint documents.
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>File</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Type</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Size</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Created</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Task</th>
                  <th className="px-4 py-3 font-semibold text-right" style={{ color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((artifact) => (
                  <tr
                    key={artifact.id}
                    className="border-t transition-colors"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover, rgba(255,255,255,0.02))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <TypeBadge type={artifact.type} />
                        <span className="font-medium truncate max-w-[300px]" style={{ color: 'var(--text-primary)' }}>
                          {artifact.name || 'Untitled'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] uppercase" style={{ color: 'var(--text-secondary)' }}>
                        {artifact.type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {formatBytes(artifact.size)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {artifact.createdAt ? new Date(artifact.createdAt).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                        style={{ color: 'var(--text-muted)', background: 'var(--bg-base)' }}
                        title={artifact.taskId}
                      >
                        {artifact.taskId ? artifact.taskId.slice(0, 12) + (artifact.taskId.length > 12 ? '…' : '') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={sovereignArtifactUrl(artifact.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                        style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.08)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.16)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                      >
                        <Download size={12} />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div
          className="text-[12px] rounded-lg border p-3"
          style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
