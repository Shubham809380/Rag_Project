import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LoaderCircle as Loader2,
  FileText,
  Upload,
  Search,
  X,
  Database,
  FileSpreadsheet,
  FileCode,
  AlertTriangle,
  RefreshCw,
  Eye,
  CircleCheck as CheckCircle,
} from 'lucide-react';
import { getSovereignDocuments, uploadSovereignDocument, getCollections, createCollection } from '../../services/sovereign';
import { DEPARTMENTS } from '../../constants/departments';

const card = { background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' };

const fileBadgeColor = (ft) => {
  const t = (ft || '').toLowerCase();
  if (t.includes('pdf')) return { bg: 'rgba(239,68,68,.12)', fg: '#EF4444' };
  if (t.includes('word') || t.includes('docx')) return { bg: 'rgba(59,130,246,.12)', fg: '#3B82F6' };
  if (t.includes('excel') || t.includes('sheet') || t.includes('xls')) return { bg: 'rgba(16,185,129,.12)', fg: '#10B981' };
  if (t.includes('powerpoint') || t.includes('ppt')) return { bg: 'rgba(245,158,11,.12)', fg: '#F59E0B' };
  if (t.includes('image') || t.includes('png') || t.includes('jpg') || t.includes('jpeg') || t.includes('tif')) return { bg: 'rgba(139,92,246,.12)', fg: '#8B5CF6' };
  return { bg: 'rgba(107,114,128,.12)', fg: '#9CA3AF' };
};

const statusStyle = (s) => ({
  background: s === 'ready' ? 'rgba(16,185,129,.12)' : s === 'processing' ? 'rgba(59,130,246,.12)' : s === 'error' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)',
  color: s === 'ready' ? '#10B981' : s === 'processing' ? '#3B82F6' : s === 'error' ? '#EF4444' : '#F59E0B',
});

export default function SovereignDocuments() {
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [docs, setDocs] = useState([]);
  const [collections, setCollections] = useState([]);
  const [, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [meta, setMeta] = useState({ collectionId: '', classification: 'INTERNAL', department: '' });
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, c] = await Promise.all([getSovereignDocuments(), getCollections()]);
      setDocs(d.documents || []);
      setCollections(c.collections || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onPickFile = async (file) => {
    if (!file) return;
    setSelected(file);
    setUploadResult(null);
  };

  const onUpload = async () => {
    if (!selected) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const r = await uploadSovereignDocument(selected, meta);
      setUploadResult({ ok: r.success !== false, message: r.success === false ? (r.error || 'Upload failed') : `Ingested ${r.chunks || 0} chunks via ${r.route || 'local'} pipeline.` });
      if (r.success !== false) {
        setSelected(null);
        await load();
      }
    } catch (e) {
      setUploadResult({ ok: false, message: e?.response?.data?.error || e.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const onCreateCollection = async () => {
    if (!newColName.trim()) return;
    try {
      await createCollection({ name: newColName.trim() });
      setNewColName('');
      setShowNewCollection(false);
      const c = await getCollections();
      setCollections(c.collections || []);
    } catch (e) {
      setUploadResult({ ok: false, message: e?.response?.data?.error || 'Failed to create collection' });
    }
  };

  const filtered = docs.filter(d => !query || (d.filename || '').toLowerCase().includes(query.toLowerCase()) || (d.classification || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {error && (
        <div className="rounded-lg border p-3 text-[12px] flex items-center gap-2" style={{ borderColor: 'rgba(239,68,68,.4)', color: '#EF4444', background: 'rgba(239,68,68,.08)' }}>
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Knowledge Base</div>
          <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Plant documents are parsed, chunked and embedded entirely on the local gateway.</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5" style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents…"
              className="rounded-md border pl-8 pr-3 py-2 text-[13px] w-56 focus:outline-none focus:ring-1"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
          <button onClick={load} className="p-2 rounded-md border hover:opacity-70" style={card} title="Refresh"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium" style={{ background: '#3B82F6', color: '#fff' }}>
            <Upload className="w-4 h-4" /> Upload Document
          </button>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.tif,.tiff,.msg" onChange={(e) => onPickFile(e.target.files?.[0])} />
        </div>
      </div>

      {/* upload panel */}
      {selected && (
        <div className="rounded-xl border p-4" style={card}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 shrink-0" style={{ color: '#3B82F6' }} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{selected.name}</div>
                <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{selected.size} bytes</div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={meta.collectionId}
                onChange={(e) => setMeta({ ...meta, collectionId: e.target.value })}
                className="rounded-md border px-2 py-1.5 text-[12px] focus:outline-none"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <option value="">No collection</option>
                {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setShowNewCollection(v => !v)} className="text-[12px] hover:underline" style={{ color: 'var(--text-secondary)' }}>
                {showNewCollection ? 'Cancel' : '+ New collection'}
              </button>
              <select
                value={meta.classification}
                onChange={(e) => setMeta({ ...meta, classification: e.target.value })}
                className="rounded-md border px-2 py-1.5 text-[12px] focus:outline-none"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                {['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'PUBLIC'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={meta.department}
                onChange={(e) => setMeta({ ...meta, department: e.target.value })}
                className="rounded-md border px-2 py-1.5 text-[12px] focus:outline-none"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <option value="">Department (optional)</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button onClick={onUpload} disabled={uploading} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium disabled:opacity-50" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</> : <><CheckCircle className="w-3.5 h-3.5" style={{ color: '#10B981' }} /> Process</>}
              </button>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:opacity-70"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {showNewCollection && (
            <div className="mt-3 flex items-center gap-2">
              <input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="New collection name"
                className="rounded-md border px-2 py-1.5 text-[12px] w-56 focus:outline-none" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
              <button onClick={onCreateCollection} className="px-3 py-1.5 rounded-md text-[12px]" style={{ background: 'rgba(16,185,129,.12)', color: '#10B981' }}>Create</button>
            </div>
          )}
          {uploadResult && (
            <div className={`mt-3 text-[12px] flex items-center gap-2 px-3 py-2 rounded-md ${uploadResult.ok ? '' : ''}`}
              style={uploadResult.ok ? { background: 'rgba(16,185,129,.08)', color: '#10B981' } : { background: 'rgba(239,68,68,.08)', color: '#EF4444' }}>
              {uploadResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {uploadResult.message}
            </div>
          )}
        </div>
      )}

      {/* table */}
      <div className="rounded-xl border overflow-hidden" style={card}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Classification</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Pages</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const c = fileBadgeColor(d.fileType);
              return (
                <tr key={d.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="p-1.5 rounded-md" style={{ background: c.bg }}><FileText className="w-4 h-4" style={{ color: c.fg }} /></span>
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[300px]" style={{ color: 'var(--text-primary)' }}>{d.filename}</div>
                        <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{d.id.slice(0, 10)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full" style={statusStyle(d.status)}>{d.status}</span></td>
                  <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ background: 'rgba(59,130,246,.1)', color: '#93C5FD' }}>{d.classification}</span></td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{d.department || '—'}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{d.pages || '—'}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{d.size ? `${(d.size / 1024).toFixed(1)} KB` : '—'}</td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => nav(`/workbench/documents/${d.id}`)} className="px-2 py-1 rounded-md text-[11px] font-medium hover:opacity-70" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <Eye className="w-3.5 h-3.5 inline mr-1" />View
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                  <Database className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  No documents in the knowledge base yet. Upload a PDF, Word, Excel or inspection image to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border p-4 text-[12px]" style={card}>
        <div className="font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>Retrieval Stack</div>
        <div className="space-y-1" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2"><FileSpreadsheet className="w-3.5 h-3.5" /> OCR route: local Tesseract / vision model — no cloud OCR.</div>
          <div className="flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Vectors: embedded locally, stored in the sovereign SQLite store.</div>
          <div className="flex items-center gap-2"><FileCode className="w-3.5 h-3.5" /> Spreadsheets: parsed locally; formulas are never executed.</div>
        </div>
      </div>
    </div>
  );
}