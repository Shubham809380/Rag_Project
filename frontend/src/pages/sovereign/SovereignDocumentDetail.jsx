import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LoaderCircle as Loader2,
  FileText,
  ArrowLeft,
  Database,
  Eye,
  ShieldAlert,
  CircleCheck as CheckCircle,
  Box,
} from 'lucide-react';
import { getSovereignDocument, sovereignSourceUrl } from '../../services/sovereign';

const card = { background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' };

export default function SovereignDocumentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [grants, setGrants] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getSovereignDocument(id);
        if (!r.document) throw new Error('not found');
        setDoc(r.document);
        setChunks(r.chunks || []);
        setGrants(r.grants || []);
      } catch (e) {
        setError(e?.response?.data?.error || e.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-[13px]" style={{ color: 'var(--text-muted)' }}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading document…
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-6">
        <div className="rounded-lg border p-4 text-[13px] flex items-center gap-2" style={{ borderColor: 'rgba(239,68,68,.4)', color: '#EF4444', background: 'rgba(239,68,68,.08)' }}>
          <ShieldAlert className="w-4 h-4" /> {error || 'Document not found'}
        </div>
        <button onClick={() => nav('/workbench/documents')} className="mt-4 text-[13px] flex items-center gap-1 hover:underline" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Knowledge Base
        </button>
      </div>
    );
  }

  const previewable = /\.(png|jpg|jpeg|bmp|tif|tiff|webp)$/i.test(doc.originalFilepath || doc.filename || '');

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <button onClick={() => nav('/workbench/documents')} className="text-[13px] flex items-center gap-1 hover:underline" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Knowledge Base
      </button>

      <div className="rounded-xl border p-4 flex flex-wrap items-start justify-between gap-4" style={card}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="p-2 rounded-md" style={{ background: 'rgba(59,130,246,.12)' }}><FileText className="w-5 h-5" style={{ color: '#3B82F6' }} /></span>
          <div className="min-w-0">
            <div className="text-lg font-bold truncate" style={{ color: 'var(--text-heading)' }}>{doc.filename || doc.name}</div>
            <div className="text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>{doc.id}</div>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
              <span className="px-2 py-0.5 rounded-full" style={{ background: doc.status === 'ready' ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)', color: doc.status === 'ready' ? '#10B981' : '#F59E0B' }}>{doc.status}</span>
              <span className="px-2 py-0.5 rounded font-mono" style={{ background: 'rgba(59,130,246,.1)', color: '#93C5FD' }}>{doc.classification}</span>
              {doc.department && <span className="px-2 py-0.5 rounded font-mono" style={{ background: 'rgba(107,114,128,.12)', color: '#9CA3AF' }}>{doc.department}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          <div><div style={{ color: 'var(--text-muted)' }}>Pages</div><div className="font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>{doc.pages || '—'}</div></div>
          <div><div style={{ color: 'var(--text-muted)' }}>Chunks</div><div className="font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>{chunks.length}</div></div>
          <div><div style={{ color: 'var(--text-muted)' }}>Size</div><div className="font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>{doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : '—'}</div></div>
          <div><div style={{ color: 'var(--text-muted)' }}>Added</div><div className="font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>{new Date(doc.createdAt).toLocaleDateString()}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <a
            href={sovereignSourceUrl(doc.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium hover:opacity-80"
            style={{ background: '#3B82F6', color: '#fff' }}
          >
            <Eye className="w-4 h-4" /> Open original source
          </a>

          {previewable && (
            <div className="rounded-xl border overflow-hidden" style={card}>
              <div className="px-4 py-2 text-[11px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Image Preview</div>
              <img src={sovereignSourceUrl(doc.id)} alt={doc.filename} className="w-full max-h-[420px] object-contain" style={{ background: 'var(--bg-base)' }} />
            </div>
          )}

          <div className="rounded-xl border" style={card}>
            <div className="px-4 py-2 text-[11px] uppercase tracking-wide font-medium flex items-center justify-between" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> Extracted Chunks ({chunks.length})</span>
            </div>
            {chunks.length === 0 && (
              <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No chunks were extracted for this document.</div>
            )}
            <div className="divide-y max-h-[600px] overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
              {chunks.map((c, i) => (
                <div key={c.index ?? i} className="px-4 py-3">
                  <div className="text-[11px] font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                    chunk #{c.index ?? i}{c.page ? ` · page ${c.page}` : ''}{c.section ? ` · ${c.section}` : ''}
                  </div>
                  <pre className="text-[12px] whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>{c.text}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border p-4" style={card}>
            <div className="flex items-center gap-2 text-[13px] font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>
              <Database className="w-4 h-4" style={{ color: '#14B8A6' }} /> Processing Metadata
            </div>
            <div className="text-[12px] space-y-2">
              {Object.entries({
                fileType: doc.fileType,
                collectionId: doc.collectionId || '—',
                pages: doc.pages || '—',
                status: doc.status,
                ingestTime: doc.ingestedAt ?? doc.createdAt ?? null,
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span className="font-mono text-right break-all" style={{ color: 'var(--text-primary)' }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border p-4" style={card}>
            <div className="flex items-center gap-2 text-[13px] font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>
              <ShieldAlert className="w-4 h-4" style={{ color: '#F59E0B' }} /> Access Grants
            </div>
            {grants.length === 0 ? (
              <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No explicit grants — access is governed by role policy.</div>
            ) : (
              <div className="text-[12px] space-y-1">
                {grants.map((g, i) => (
                  <div key={i} className="flex justify-between font-mono">
                    <span style={{ color: 'var(--text-primary)' }}>{g.email || g.role || g.userId}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{g.permission || g.grant || 'read'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-[11px] flex items-start gap-1" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#10B981' }} />
              Document access attempts are recorded in the audit log with the requesting user.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}