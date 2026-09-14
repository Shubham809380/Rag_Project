import { useState, useRef } from 'react';
import {
  Database,
  Upload,
  LoaderCircle as Loader2,
  AlertTriangle,
  X,
  Table2,
  FileSpreadsheet,
  CheckCircle,
} from 'lucide-react';
import { analyzeDatasetFile } from '../../services/sovereign';

const TYPE_COLOR = {
  numeric: '#10B981',
  text: '#6B7280',
  date: '#8B5CF6',
};

function StatCell({ value, mono }) {
  if (value == null || value === '') return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <span className={mono !== false ? 'font-mono text-[11px]' : ''} style={{ color: 'var(--text-secondary)' }}>
      {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(4)) : value}
    </span>
  );
}

export default function SovereignDataAnalysis() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError('');
    }
  };

  const handleClear = () => {
    setFile(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const r = await analyzeDatasetFile(file);
      setResult(r);
      if (!r.ok && r.reason) setError(r.reason);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Analysis request failed');
    } finally {
      setLoading(false);
    }
  };

  const columns = result?.columns || [];
  const anomalies = result?.anomalies || [];
  const sample = result?.sample || [];

  return (
    <div className="p-6 h-full flex flex-col max-w-[1200px] mx-auto w-full">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <Database size={18} style={{ color: '#8B5CF6' }} />
          <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-heading)' }}>Dataset Analysis</h1>
        </div>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Statistical profile of CSV/XLSX datasets computed locally — no data leaves the plant.
        </p>
      </div>

      {/* Output area (top) */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4 pr-1">
        {/* Error strip */}
        {error && (
          <div
            className="rounded-xl border p-4 flex items-start gap-3"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <AlertTriangle size={18} style={{ color: '#EF4444', marginTop: 1 }} />
            <div>
              <div className="text-[12px] font-semibold" style={{ color: '#EF4444' }}>Analysis failed</div>
              <div className="text-[12px] mt-1" style={{ color: '#FCA5A5' }}>{error}</div>
            </div>
          </div>
        )}

        {/* Result header */}
        {result && result.ok && (
          <div
            className="rounded-xl border p-4 flex flex-wrap items-center gap-x-6 gap-y-2"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={15} style={{ color: '#8B5CF6' }} />
              <span className="font-mono text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                {result.filename}
              </span>
            </div>
            {result.workbook && (
              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                Sheet: <span className="font-mono" style={{ color: 'var(--text-heading)' }}>{result.workbook}</span>
              </span>
            )}
            <span className="font-mono text-[12px] px-2 py-0.5 rounded" style={{ color: '#10B981', background: 'rgba(16,185,129,0.12)' }}>
              {result.rows} rows
            </span>
            <span className="font-mono text-[12px] px-2 py-0.5 rounded" style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.12)' }}>
              {result.cols} cols
            </span>
          </div>
        )}

        {/* Columns table */}
        {result && result.ok && columns.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <Table2 size={14} style={{ color: '#3B82F6' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
                Column Profiles
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="px-3 py-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Name</th>
                    <th className="px-3 py-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Type</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: 'var(--text-muted)' }}>Values</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: 'var(--text-muted)' }}>Nulls</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: 'var(--text-muted)' }}>Min</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: 'var(--text-muted)' }}>Max</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: 'var(--text-muted)' }}>Mean</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: 'var(--text-muted)' }}>Std</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, i) => (
                    <tr key={col.name || i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-heading)' }}>{col.name}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase"
                          style={{
                            color: TYPE_COLOR[col.type?.toLowerCase()] || '#6B7280',
                            background: `${TYPE_COLOR[col.type?.toLowerCase()] || '#6B7280'}18`,
                          }}
                        >
                          {col.type || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{col.values ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: col.nulls > 0 ? '#F59E0B' : 'var(--text-secondary)' }}>{col.nulls ?? '—'}</td>
                      <td className="px-3 py-2 text-right"><StatCell value={col.min} /></td>
                      <td className="px-3 py-2 text-right"><StatCell value={col.max} /></td>
                      <td className="px-3 py-2 text-right"><StatCell value={col.mean} /></td>
                      <td className="px-3 py-2 text-right"><StatCell value={col.std} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Anomalies section */}
        {result && result.ok && anomalies.length > 0 && (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ background: 'rgba(245,158,11,0.04)', borderColor: 'rgba(245,158,11,0.3)' }}
          >
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
              <AlertTriangle size={14} style={{ color: '#F59E0B' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#F59E0B' }}>
                Anomalies Detected ({anomalies.length})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left" style={{ borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
                    <th className="px-3 py-2.5 font-semibold" style={{ color: '#FCD34D' }}>Column</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: '#FCD34D' }}>Row</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: '#FCD34D' }}>Value</th>
                    <th className="px-3 py-2.5 font-semibold text-right" style={{ color: '#FCD34D' }}>z-Score</th>
                    <th className="px-3 py-2.5 font-semibold" style={{ color: '#FCD34D' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
                      <td className="px-3 py-2 font-mono font-semibold" style={{ color: 'var(--text-heading)' }}>{a.column}</td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{a.row}</td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{String(a.value)}</td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: '#F59E0B' }}>{a.zScore != null ? a.zScore.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{a.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sample preview */}
        {result && result.ok && sample.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <CheckCircle size={14} style={{ color: '#3B82F6' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
                Sample Preview (first {Math.min(sample.length, 10)} rows)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {columns.map((col, ci) => (
                      <th key={ci} className="px-3 py-2 font-semibold text-left whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.slice(0, 10).map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {row.map((val, ci) => (
                        <td key={ci} className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {val != null ? String(val) : <span style={{ color: 'var(--text-muted)' }}>null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div
            className="rounded-xl border p-10 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <Database size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
              Upload a CSV or XLSX file and press analyze.
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Column profiles, statistics, and anomaly detection appear here — entirely on-premise.
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div
            className="rounded-xl border p-10 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <Loader2 size={28} className="mx-auto mb-3 animate-spin" style={{ color: '#8B5CF6' }} />
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
              Analyzing dataset…
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Computing column profiles, statistics, and anomalies.
            </p>
          </div>
        )}
      </div>

      {/* Composer bar (bottom) */}
      <div className="shrink-0 mt-4">
        <div
          className="rounded-xl border p-4 flex flex-wrap items-center gap-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          {file ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border min-w-[220px] max-w-full" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet size={14} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{file.name}</span>
              </div>
              <button onClick={handleClear} className="shrink-0 p-1 rounded hover:bg-red-500/10 transition-colors">
                <X size={14} style={{ color: '#EF4444' }} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-[12px] font-medium transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-base)' }}
            >
              <Upload size={14} />
              Attach CSV / XLSX
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <span className="hidden md:block text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Statistical profiling &amp; anomaly detection — computed locally, nothing leaves the plant.
          </span>
          <div className="flex-1" />
          {file && (
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
            </span>
          )}
          <button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#8B5CF6', color: '#fff' }}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Database size={14} />
                Analyze
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}