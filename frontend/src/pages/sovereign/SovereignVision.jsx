import { useEffect, useState, useRef } from 'react';
import {
  Scan,
  Eye,
  AlertTriangle,
  LoaderCircle as Loader2,
  X,
  CheckCircle,
  ImagePlus,
} from 'lucide-react';
import { analyzeImageFile, getSovereignStatus } from '../../services/sovereign';

const TAG_COLORS = [
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#06B6D4',
];

function InfoRow({ label, items, color }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium"
            style={{ color: color || 'var(--text-secondary)', background: `${color || '#6B7280'}18` }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ListItem({ label, items, color }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[12px] pl-3 relative" style={{ color: color || 'var(--text-secondary)' }}>
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
              style={{ background: color || '#6B7280' }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SovereignVision() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await getSovereignStatus();
        if (active) setStatus(s);
      } catch {
        // status fetch failure is non-critical
      } finally {
        if (active) setStatusLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const models = status?.models || [];
  const hasVisionModel = models.some(
    (m) => m.role === 'vision' || (Array.isArray(m.capabilities) && m.capabilities.includes('vision'))
  );

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      previewUrlRef.current = url;
    } else {
      setPreview(null);
      previewUrlRef.current = null;
    }
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [file]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const handleClear = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await analyzeImageFile(file, prompt || undefined);
      setResult(r);
    } catch (e) {
      setResult({
        success: false,
        ok: false,
        reason: e?.response?.data?.error || e?.message || 'Request failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const obs = result?.observations;
  const prov = result?.provenance;
  const isSuccess = result && (result.success || result.ok);
  const isUnavailable = result && !isSuccess && (result.reason || result.success === false || result.ok === false);

  return (
    <div className="p-6 h-full flex flex-col max-w-[1200px] mx-auto w-full">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <Scan size={18} style={{ color: '#3B82F6' }} />
          <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-heading)' }}>Visual Inspection</h1>
        </div>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Image observation runs fully on the local gateway — nothing leaves the plant.
        </p>
      </div>

      {/* Model status strip */}
      <div
        className="shrink-0 mt-3 rounded-lg border px-4 py-2.5 flex items-center gap-2 text-[12px] font-medium"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {statusLoading ? (
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        ) : hasVisionModel ? (
          <>
            <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
            <span style={{ color: '#10B981' }}>Local vision model available</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />
            <span style={{ color: '#F59E0B' }}>No local vision model configured</span>
          </>
        )}
      </div>

      {/* Output area (top) */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4 pr-1">
        {loading && (
          <div className="rounded-lg border px-3 py-2 text-[11px]" style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)', color: 'var(--text-secondary)' }}>
            Local vision model (qwen3-vl:8b) is inspecting the image on CPU — this can take 1–4 minutes on first run. Please keep this tab open.
          </div>
        )}
        {/* Thumbnail preview */}
        {preview && (
          <div>
            <img
              src={preview}
              alt="Inspection preview"
              className="rounded-lg border max-h-48 object-contain"
              style={{ borderColor: 'var(--border-subtle)' }}
            />
          </div>
        )}

        {/* Error / unavailable strip */}
        {isUnavailable && (
          <div
            className="rounded-xl border p-4 flex items-start gap-3"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <AlertTriangle size={18} style={{ color: '#EF4444', marginTop: 1 }} />
            <div>
              <div className="text-[12px] font-semibold" style={{ color: '#EF4444' }}>Analysis unavailable</div>
              <div className="text-[12px] mt-1" style={{ color: '#FCA5A5' }}>{result.reason}</div>
            </div>
          </div>
        )}

        {/* Success results */}
        {isSuccess && obs && (
          <div className="space-y-4">
            {/* Description */}
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                Description
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {obs.description || '—'}
              </p>
            </div>

            {/* Text & Labels Found */}
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <InfoRow label="Text & Labels Found" items={obs.textFound} color={TAG_COLORS[0]} />
              <div className="mt-3">
                <InfoRow label="Tags / IDs" items={obs.tags} color={TAG_COLORS[1]} />
              </div>
            </div>

            {/* Lines & Relationships */}
            <div
              className="rounded-xl border p-4 space-y-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <ListItem label="Lines" items={obs.lines} color={TAG_COLORS[2]} />
              <ListItem label="Relationships" items={obs.relationships} color={TAG_COLORS[3]} />
            </div>

            {/* Uncertainties (amber) */}
            {obs.uncertainties && obs.uncertainties.length > 0 && (
              <div
                className="rounded-xl border p-4"
                style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.3)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} style={{ color: '#F59E0B' }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#F59E0B' }}>
                    Uncertainties
                  </span>
                </div>
                <ul className="space-y-1">
                  {obs.uncertainties.map((u, i) => (
                    <li key={i} className="text-[12px] pl-3 relative" style={{ color: '#FCD34D' }}>
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full" style={{ background: '#F59E0B' }} />
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warning */}
            {obs.warning && (
              <div
                className="rounded-lg border px-4 py-2.5 flex items-center gap-2 text-[12px]"
                style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', color: '#F59E0B' }}
              >
                <AlertTriangle size={14} />
                {obs.warning}
              </div>
            )}

            {/* Human verification banner */}
            <div
              className="rounded-lg border px-4 py-2.5 flex items-center gap-2 text-[12px] font-medium"
              style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)', color: '#3B82F6' }}
            >
              <CheckCircle size={14} />
              AI observation — requires human verification
            </div>

            {/* Meta row */}
            <div
              className="rounded-xl border p-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px]"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              {result.model && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Model: </span>
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{result.model}</span>
                </div>
              )}
              {prov?.timestamp && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Timestamp: </span>
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(prov.timestamp).toLocaleString()}
                  </span>
                </div>
              )}
              {prov?.sourceImage && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>File: </span>
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{prov.sourceImage}</span>
                </div>
              )}
              {result.confidence != null && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Confidence: </span>
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{result.confidence}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div
            className="rounded-xl border p-10 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <Eye size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
              Attach an inspection image and press analyze.
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              The model will describe what it observes — results appear here, entirely on-premise.
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div
            className="rounded-xl border p-10 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <Loader2 size={28} className="mx-auto mb-3 animate-spin" style={{ color: '#3B82F6' }} />
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
              Analyzing image…
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              This may take a few moments depending on image size.
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
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border min-w-[220px] max-w-full" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
              <img src={preview} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
              <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{file.name}</span>
              <button onClick={handleClear} className="shrink-0 p-1 rounded hover:bg-red-500/10 transition-colors">
                <X size={14} style={{ color: '#EF4444' }} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed text-[12px] font-medium transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-base)' }}
            >
              <ImagePlus size={14} />
              Attach image
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/bmp,image/tiff"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAnalyze(); } }}
            placeholder="Describe what to look for (optional) — Enter to analyze…"
            className="flex-1 min-w-[180px] rounded-lg border px-3 py-2 text-[12px] focus:outline-none focus:ring-1"
            style={{
              background: 'var(--bg-base)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#3B82F6', color: '#fff' }}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Eye size={14} />
                Analyze
              </>
            )}
          </button>
        </div>
        <div className="mt-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          PNG · JPG · BMP · TIFF — press Enter to run
        </div>
      </div>
    </div>
  );
}