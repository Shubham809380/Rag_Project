import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { GitCompare, Loader2, Download, FileSearch } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { Card, PageHeader, EmptyState, PageLoader, PrimaryButton, GhostButton, Badge } from '../components/common/ui';
import Markdown from '../components/common/Markdown';
import { useDocuments } from '../hooks/useCatalog';
import { compareDocuments, exportContent } from '../services/api';
import { useLanguage } from '../i18n';

export default function ComparePage() {
  const { documents, loading } = useDocuments();
  const { t } = useLanguage();
  const [selected, setSelected] = useState([]);
  const [question, setQuestion] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const run = async () => {
    if (selected.length < 2) return toast.error('Select at least 2 documents to compare');
    setRunning(true);
    try {
      const res = await compareDocuments(selected, question.trim());
      if (res.success) setResult(res);
      else toast.error(res.message || 'Comparison failed');
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setRunning(false); }
  };

  const handleExport = async () => {
    if (!result?.comparison) return;
    try { const r = await exportContent({ format: 'markdown', title: 'Document Comparison', content: result.comparison, contentType: 'text/markdown' }); const blob = await new Response(r).blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'comparison.md'; a.click(); URL.revokeObjectURL(url); }
    catch { const blob = new Blob([`# Document Comparison\n\n${result.comparison}`], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'comparison.md'; a.click(); URL.revokeObjectURL(url); }
  };

  return (
    <AppLayout title={t('compare')}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' } }} />
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader title={t('compare')} subtitle="Compare two or more documents for similarities, differences and contradictions" />

        <Card className="mb-6">
          <p className="text-sm font-medium text-fg mb-3">Select documents ({selected.length})</p>
          {loading ? <PageLoader /> : documents.length === 0 ? (
            <EmptyState icon={FileSearch} title="No documents" description="Upload documents first to compare them." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {documents.map((d) => (
                <label key={d.id} onClick={() => toggle(d.id)}
                  className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors"
                  style={{ borderColor: selected.includes(d.id) ? '#3B82F6' : 'var(--border-default)', background: selected.includes(d.id) ? 'rgba(59,130,246,0.08)' : 'var(--bg-input)' }}>
                  <input type="checkbox" checked={selected.includes(d.id)} onChange={() => {}} className="accent-blue-500" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-fg truncate">{d.file_name}</p>
                    <p className="text-[11px] text-fg-muted">{d.chunk_count ?? 0} chunks</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </Card>

        <Card className="mb-6">
          <label className="block text-sm font-medium text-fg mb-1">Focus question (optional)</label>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2}
            className="w-full rounded-xl border bg-input px-4 py-3 text-sm text-fg focus-ring outline-none"
            style={{ borderColor: 'var(--border-default)' }}
            placeholder="e.g. How do the pricing models differ?" />
          <PrimaryButton onClick={run} disabled={running || selected.length < 2} className="mt-4 w-full">
            {running ? <Loader2 size={16} className="animate-spin" /> : <GitCompare size={16} />}
            {running ? 'Comparing...' : 'Compare Documents'}
          </PrimaryButton>
        </Card>

        {result?.comparison && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-heading">Comparison Result</h3>
              <GhostButton onClick={handleExport}><Download size={15} /> Export</GhostButton>
            </div>
            <Markdown>{result.comparison}</Markdown>
            <div className="mt-6 flex gap-2">
              {result.documents?.map((d, i) => <Badge key={i} color="#8B5CF6">{d.file_name}</Badge>)}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
