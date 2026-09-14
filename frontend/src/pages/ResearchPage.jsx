import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Search, Loader2, Download, History, Globe, Database } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import {
  Card, PageHeader, PrimaryButton, GhostButton, Select, Badge, Spinner,
} from '../components/common/ui';
import Markdown from '../components/common/Markdown';
import { useDocuments, useKnowledgeBases } from '../hooks/useCatalog';
import { runResearch, getResearchHistory, deleteResearch, exportContent } from '../services/api';
import { useLanguage } from '../i18n';

export default function ResearchPage() {
  const { documents } = useDocuments();
  const { kbs } = useKnowledgeBases();
  const { t } = useLanguage();
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState('kb');
  const [kbId, setKbId] = useState('');
  const [fileIds, setFileIds] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    try { const d = await getResearchHistory(); setHistory(d.sessions || []); } catch {}
  };

  const toggleFile = (id) => setFileIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const run = async () => {
    if (!question.trim()) return toast.error('Enter a research question');
    setRunning(true);
    setResult(null);
    setProgress(['Understanding Query', 'Breaking into Sub-Questions', 'Searching Knowledge Base',
      mode !== 'kb' ? 'Searching the Web' : '', 'Comparing Sources', 'Detecting Contradictions', 'Generating Report'].filter(Boolean).map((s) => ({ step: s, status: 'pending' })));
    try {
      const res = await runResearch({ question: question.trim(), mode, knowledgeBaseId: kbId || null, fileIds: fileIds.length ? fileIds : undefined });
      if (res.success) {
        setResult(res);
        setProgress(res.progress || []);
      } else toast.error(res.message || 'Research failed');
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setRunning(false); }
  };

  const handleExport = async () => {
    if (!result?.report) return;
    try {
      const res = await exportContent({ format: 'markdown', title: 'Research Report', content: result.report, contentType: 'text/markdown' });
      // fall back to client-side download if API returns JSON
      const reader = new Response(res).blob();
      const blob = await reader;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'research-report.md'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      const blob = new Blob([`# Research Report\n\n${result.report}`], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'research-report.md'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const activeStep = progress.findIndex((s) => s.status === 'running');

  return (
    <AppLayout title={t('research')}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' } }} />
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader title={t('research')} subtitle="Deep-dive into your documents (and optionally the web) and get a structured research report"
          actions={<GhostButton onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}><History size={15} /> History</GhostButton>} />

        {showHistory && (
          <Card className="mb-6">
            <h3 className="font-semibold text-heading mb-3">Past Research</h3>
            <div className="space-y-1">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 py-1.5 text-sm border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="truncate text-fg">{h.question}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-fg-muted">{new Date(h.created_at).toLocaleDateString()}</span>
                    <button onClick={() => deleteResearch(h.id).then(loadHistory)} className="text-fg-muted hover:text-error">✕</button>
                  </div>
                </div>
              ))}
              {history.length === 0 && <p className="text-sm text-fg-muted">No research yet.</p>}
            </div>
          </Card>
        )}

        <Card className="mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-1">{t('researchQuestion')}</label>
              <TextArea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
                placeholder="e.g. What are the key findings and contradictions across my documents?" />
            </div>

            <div className="flex flex-wrap gap-2">
              {[['kb', t('kbOnly'), Database], ['web', 'Web research', Globe]].map(([val, label, Icon]) => (
                <button key={val} onClick={() => setMode(val)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-ring`}
                  style={mode === val
                    ? { background: 'linear-gradient(135deg, #3B82F6, #22D3EE)', color: '#fff' }
                    : { border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Knowledge Base (optional)</label>
                <Select value={kbId} onChange={(e) => { setKbId(e.target.value); setFileIds([]); }} className="w-full">
                  <option value="">All documents</option>
                  {kbs.map((kb) => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Specific documents</label>
                <div className="max-h-32 overflow-y-auto space-y-1 rounded-xl border p-3" style={{ borderColor: 'var(--border-default)' }}>
                  {documents.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-[13px] text-fg cursor-pointer">
                      <input type="checkbox" checked={fileIds.includes(d.id)} onChange={() => toggleFile(d.id)} />
                      <span className="truncate">{d.file_name}</span>
                    </label>
                  ))}
                  {documents.length === 0 && <span className="text-[12px] text-fg-muted">No documents uploaded.</span>}
                </div>
              </div>
            </div>

            <PrimaryButton onClick={run} disabled={running || !question.trim()} className="w-full">
              {running ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {running ? 'Researching...' : t('runResearch')}
            </PrimaryButton>
          </div>
        </Card>

        {progress.length > 0 && running && (
          <Card className="mb-6">
            <h3 className="font-semibold text-heading mb-4">Research Progress</h3>
            <div className="space-y-2">
              {progress.map((p, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  {i < activeStep ? <span style={{ color: '#22C55E' }}>✓</span>
                    : p.status === 'running' ? <Spinner size={14} />
                    : <span className="w-[14px]" />}
                  <span style={{ color: p.status === 'running' ? 'var(--text-primary)' : 'var(--text-fg)' }} className={p.status === 'running' ? 'text-fg' : 'text-fg-muted'}>{p.step}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {result && result.report && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-heading flex items-center gap-2"><Search size={17} style={{ color: '#3B82F6' }} /> {result.subQuestions?.[0] || 'Research Report'}</h3>
              <GhostButton onClick={handleExport}><Download size={15} /> Export</GhostButton>
            </div>
            <Markdown>{result.report}</Markdown>
            {(result.sources?.knowledgeBase?.length > 0 || result.sources?.web?.length > 0) && (
              <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
                <h4 className="font-semibold text-heading mb-2">Sources</h4>
                <div className="space-y-1">
                  {result.sources.knowledgeBase?.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-fg-muted"><Badge color="#3B82F6">KB</Badge> {s.name}</div>
                  ))}
                  {result.sources.web?.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-fg-muted"><Badge color="#F59E0B">Web</Badge> <a className="text-primary underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function TextArea({ ...props }) {
  return <textarea {...props} className="w-full rounded-xl border bg-input px-4 py-3 text-sm text-fg placeholder:text-fg-muted focus-ring outline-none" style={{ borderColor: 'var(--border-default)' }} />;
}
