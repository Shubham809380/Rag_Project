import { useState, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { FolderOpen, Upload, Trash2, FileSearch, Download, Sparkles, Loader2 } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import {
  Card, PageHeader, EmptyState, PageLoader, Badge, PrimaryButton, GhostButton, Select,
} from '../components/common/ui';
import Markdown from '../components/common/Markdown';
import ConfirmModal from '../components/common/ConfirmModal';
import { useDocuments, useKnowledgeBases } from '../hooks/useCatalog';
import { uploadDocument, deleteDocument, summarizeDocument, getSummaryTypes } from '../services/api';
import { useLanguage } from '../i18n';

const STATUS_COLORS = {
  ready: '#22C55E', processing: '#3B82F6', failed: '#EF4444',
  true: '#22C55E', false: '#F59E0B',
};

function formatSize(bytes) {
  if (!bytes) return '—';
  const kb = bytes / 1024;
  if (kb > 1024) return (kb / 1024).toFixed(1) + ' MB';
  return kb.toFixed(0) + ' KB';
}

export default function DocumentsPage() {
  const { documents, loading, reload } = useDocuments();
  const { kbs } = useKnowledgeBases();
  const { t } = useLanguage();
  const [kbFilter, setKbFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [summaryDoc, setSummaryDoc] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryContent, setSummaryContent] = useState(null);
  const [summaryType, setSummaryType] = useState('quick');
  const [summaryTypes, setSummaryTypes] = useState([]);
  const fileRef = useRef(null);

  const filtered = kbFilter ? documents.filter((d) => d.knowledge_base_id === kbFilter) : documents;

  const handleFiles = async (files) => {
    const fileList = Array.from(files);
    setUploading(true);
    for (const file of fileList) {
      try {
        const res = await uploadDocument(file, kbFilter || null);
        const first = res?.files?.[0];
        if (first?.error) toast.error(`${file.name}: ${first.error}`);
        else toast.success(`${file.name} uploaded (${first?.chunks ?? 0} chunks)`);
      } catch (err) {
        toast.error(`${file.name}: ${err.response?.data?.message || err.message}`);
      }
    }
    setUploading(false);
    await reload();
    fileRef.current.value = '';
  };

  const openSummary = async (doc) => {
    setSummaryDoc(doc);
    setSummaryContent(null);
    setSummaryType('quick');
    try { const s = await getSummaryTypes(); setSummaryTypes(s.types || []); } catch {}
  };

  const runSummary = async () => {
    if (!summaryDoc) return;
    setSummaryLoading(true);
    try {
      const res = await summarizeDocument(summaryDoc.id, summaryType);
      if (res.success) setSummaryContent(res.content);
      else toast.error(res.message || 'Failed to summarize');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally { setSummaryLoading(false); }
  };

  const handleExport = (content) => {
    const blob = new Blob([`# ${summaryDoc?.file_name}\n\n${content}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${summaryDoc?.file_name?.replace(/\.[^.]+$/, '') || 'summary'}-summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout title={t('documents')}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' } }} />
      <div className="max-w-6xl mx-auto p-6">
        <PageHeader
          title={t('documents')}
          subtitle={t('uploadNotice')}
          actions={
            <PrimaryButton disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Uploading...' : t('uploadDocument')}
            </PrimaryButton>
          }
        />
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)}
          accept=".pdf,.docx,.txt,.csv,.xlsx,.md,.png,.jpg,.jpeg" />

        {kbs.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <Select value={kbFilter} onChange={(e) => setKbFilter(e.target.value)}>
              <option value="">All documents</option>
              {kbs.map((kb) => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
            </Select>
          </div>
        )}

        {loading ? <PageLoader /> : documents.length === 0 ? (
          <Card>
            <EmptyState
              icon={FolderOpen}
              title="No documents yet"
              description={t('uploadNotice')}
              action={<PrimaryButton onClick={() => fileRef.current?.click()}><Upload size={16} /> {t('uploadDocument')}</PrimaryButton>}
            />
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((d) => (
              <Card key={d.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                  <FileSearch size={18} style={{ color: '#3B82F6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-fg truncate">{d.file_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[12px] text-fg-muted">
                    <span>{formatSize(d.file_size)}</span>
                    <span>·</span>
                    <span>{d.pages || 0} pages</span>
                    <span>·</span>
                    <span>{d.total_chunks ?? d.chunk_count ?? 0} chunks</span>
                    {d.file_type && (<span>· <Badge>{d.file_type}</Badge></span>)}
                    {(d.status || d.embedding_status) && (
                      <span>· <Badge color={STATUS_COLORS[d.status || 'ready']}>{d.status || d.embedding_status}</Badge></span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <GhostButton onClick={() => openSummary(d)} title="Summarize">
                    <Sparkles size={15} />
                    <span className="hidden sm:inline">Summarize</span>
                  </GhostButton>
                  <button onClick={() => setDeleteTarget(d)} className="p-2 rounded-lg text-fg-muted hover:bg-card-hover hover:text-error" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Summary modal */}
      {summaryDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSummaryDoc(null)} />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-card p-6" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                <FolderOpen size={18} style={{ color: '#3B82F6' }} /> {summaryDoc.file_name}
              </h3>
              <button onClick={() => setSummaryDoc(null)} className="p-2 rounded-lg text-fg-muted hover:bg-card-hover">✕</button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Select value={summaryType} onChange={(e) => setSummaryType(e.target.value)}>
                {(summaryTypes.length ? summaryTypes : [
                  { id: 'quick', label: 'Quick Summary' }, { id: 'detailed', label: 'Detailed Summary' },
                  { id: 'executive', label: 'Executive Summary' }, { id: 'keypoints', label: 'Key Points' },
                  { id: 'definitions', label: 'Definitions' }, { id: 'dates', label: 'Important Dates' },
                  { id: 'actions', label: 'Action Items' },
                ]).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
              <PrimaryButton onClick={runSummary} disabled={summaryLoading}>
                {summaryLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generate
              </PrimaryButton>
            </div>
            {summaryContent && (
              <>
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-input)' }}>
                  <Markdown>{summaryContent}</Markdown>
                </div>
                <div className="flex justify-end mt-4">
                  <GhostButton onClick={() => handleExport(summaryContent)}><Download size={15} /> Export</GhostButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteDocument(deleteTarget.id);
            toast.success('Document deleted');
          } catch { toast.error('Failed to delete document'); }
          setDeleteTarget(null);
          await reload();
        }}
        title="Delete Document"
        message="This will permanently delete this document and its chunks."
        confirmLabel="Delete"
      />
    </AppLayout>
  );
}
