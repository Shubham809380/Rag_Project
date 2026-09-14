import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Loader2, Plus, Boxes } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import {
  getCollections, createCollection, getSovereignDocuments, uploadSovereignDocument, sovereignSourceUrl,
} from '../services/sovereign';

const CLASSIFICATIONS = ['INTERNAL', 'RESTRICTED', 'CONFIDENTIAL', 'PUBLIC'];
const STATUS_COLOR = {
  ready: '#10B981', indexed: '#3B82F6', ocr_required: '#F59E0B', empty: '#EF4444', embed_failed: '#EF4444', failed: '#EF4444',
};

export default function SovereignDocuments() {
  const [docs, setDocs] = useState([]);
  const [cols, setCols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classif, setClassif] = useState('INTERNAL');
  const fileRef = useRef(null);

  const refresh = async () => {
    const [d, c] = await Promise.all([getSovereignDocuments(), getCollections()]);
    setDocs(d.documents || []); setCols(c.collections || []);
  };

  useEffect(() => {
    (async () => {
      try { await refresh(); } catch (e) { setError(e?.response?.data?.error || e?.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const doUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError('');
    try {
      await uploadSovereignDocument(file, { classification: classif });
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed');
    } finally { setLoading(false); }
  };

  const newCollection = async () => {
    const name = window.prompt('Collection name');
    if (!name) return;
    try {
      await createCollection({ name });
      setCols(await getCollections().then(r => r.collections || []));
    } catch (err) { setError(err?.message); }
  };

  if (loading && docs.length === 0) return <AppLayout title="Sovereign Documents"><div className="p-8 text-fg-muted">Loading…</div></AppLayout>;

  return (
    <AppLayout title="Sovereign Documents">
      <div className="p-6 space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-heading">Uploaded documents</h2>
            <p className="text-[13px] text-fg-muted">Stored locally, parsed, chunked and embedded in SQLite. Access-controlled by role.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={classif} onChange={e => setClassif(e.target.value)}
              className="rounded-lg border px-2 py-2 text-sm" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--fg)' }}>
              {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => fileRef.current?.click()} disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#22D3EE)' }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={doUpload} />
          </div>
        </div>

        {error && <div className="text-error text-sm">{error}</div>}

        <div className="flex items-center gap-2">
          <Boxes size={16} style={{ color: '#3B82F6' }} />
          <span className="text-sm font-semibold text-heading">Collections ({cols.length})</span>
          <button onClick={newCollection} className="flex items-center gap-1 text-[13px] text-blue-400 hover:underline"><Plus size={14} /> new</button>
        </div>
        {cols.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cols.map(c => (
              <span key={c.id} className="px-3 py-1 rounded-full text-[12px] bg-blue-500/10 text-blue-400 font-medium">{c.name} · {c.department || 'general'}</span>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          {docs.map(d => (
            <div key={d.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.12)' }}>
                  <FileText size={16} style={{ color: '#3B82F6' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-heading truncate" title={d.filename}>{d.filename}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ color: STATUS_COLOR[d.status] || '#f43f5e', background: `${STATUS_COLOR[d.status] || '#f43f5e'}22` }}>{d.status}</span>
                  </div>
                  <div className="text-[12px] text-fg-muted mt-1 space-x-3">
                    <span>{d.fileType} · {d.pages}p · {(d.size / 1024).toFixed(1)}KB</span>
                    <span className={d.classification === 'RESTRICTED' || d.classification === 'CONFIDENTIAL' ? 'text-amber-500' : ''}>{d.classification}</span>
                    {d.department && <span>{d.department}</span>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <a href={sovereignSourceUrl(d.id)} target="_blank" rel="noreferrer" className="text-[12px] text-blue-400 hover:underline">source</a>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {docs.length === 0 && <div className="text-fg-muted text-sm col-span-full">No documents have been ingested yet.</div>}
        </div>
      </div>
    </AppLayout>
  );
}