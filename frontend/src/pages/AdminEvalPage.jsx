import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ShieldCheck, Loader2, Activity, FileSearch } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { Card, PageHeader, PrimaryButton, Select, Badge, Spinner } from '../components/common/ui';
import { useKnowledgeBases } from '../hooks/useCatalog';
import { runEvaluation, getEvalHistory } from '../services/api';
import { useAuth } from '../context/AuthContext';

const METRICS = [
  { key: 'precision', label: 'Precision', color: '#3B82F6' },
  { key: 'recall', label: 'Recall', color: '#8B5CF6' },
  { key: 'contextRelevance', label: 'Context Relevance', color: '#22D3EE' },
  { key: 'answerFaithfulness', label: 'Answer Faithfulness', color: '#22C55E' },
  { key: 'citationCorrectness', label: 'Citation Correctness', color: '#F59E0B' },
  { key: 'hallucinationRate', label: 'Hallucination Rate', color: '#EF4444' },
];

export default function AdminEvalPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email === 'patrashubhamm031@gmail.com';
  const { kbs } = useKnowledgeBases();
  const [kbId, setKbId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await runEvaluation({ questionsBaseType: 'default', knowledgeBaseId: kbId || null });
      if (res.success) { setResult(res); toast.success('Evaluation complete'); }
      else toast.error(res.message || 'Evaluation failed');
      const h = await getEvalHistory('all'); setHistory(h.history || []);
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setRunning(false); }
  };

  return (
    <AppLayout title="RAG Evaluation (Admin)">
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' } }} />
      <div className="max-w-5xl mx-auto p-6">
        <PageHeader title="RAG Evaluation" subtitle="Run standardized test questions to measure retrieval quality"
          actions={
            <Select value={kbId} onChange={(e) => setKbId(e.target.value)}>
              <option value="">All documents</option>
              {kbs.map((kb) => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
            </Select>
          } />

        <Card className="mb-6">
          <p className="text-sm text-fg-muted mb-4">Evaluates precision, recall, context relevance, faithfulness, citation correctness and hallucination rate using a judge model across your knowledge base.</p>
          <PrimaryButton onClick={run} disabled={running}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {running ? 'Evaluating...' : 'Run Evaluation'}
          </PrimaryButton>
          {running && <div className="mt-4 flex items-center gap-2 text-sm text-fg-muted"><Spinner size={15} /> Running test questions against retrieval + generation...</div>}
        </Card>

        {result?.summary && (
          <Card className="mb-6">
            <h3 className="font-semibold text-heading mb-4 flex items-center gap-2"><Activity size={16} style={{ color: '#3B82F6' }} /> Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              {METRICS.map(({ key, label, color }) => (
                <div key={key} className="text-center">
                  <div className="text-2xl font-bold" style={{ color }}>{Math.round((result.summary[key] || 0) * 100)}%</div>
                  <div className="text-[11px] text-fg-muted">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-fg-muted">Avg latency: {(result.summary.avgLatencyMs / 1000).toFixed(1)}s</p>
          </Card>
        )}

        {result?.results?.length > 0 && (
          <Card className="mb-6">
            <h3 className="font-semibold text-heading mb-4">Per-Question Breakdown</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {result.results.map((r, i) => (
                <div key={i} className="border rounded-xl p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-fg">{i + 1}. {r.question}</p>
                    <Badge color={r.answerFaithfulness >= 0.6 ? '#22C55E' : r.answerFaithfulness >= 0.4 ? '#F59E0B' : '#EF4444'}>
                      faithful {(r.answerFaithfulness * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  {r.answer && <p className="text-[13px] text-fg-muted mt-1 line-clamp-3">{r.answer}</p>}
                  {r.notes && <p className="text-[12px] text-fg-muted mt-1 italic">{r.notes}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {history.length > 0 && (
          <Card>
            <h3 className="font-semibold text-heading mb-4 flex items-center gap-2"><FileSearch size={16} style={{ color: '#8B5CF6' }} /> Evaluation History</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm border-b py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-fg-muted truncate mr-2">{h.question}</span>
                  <div className="flex items-center gap-2 shrink-0 text-[12px] text-fg-muted">
                    <Badge color="#22C55E">F {(h.answer_faithfulness || 0).toFixed(2)}</Badge>
                    <Badge color="#F59E0B">H {(h.hallucination_rate || 0).toFixed(2)}</Badge>
                    <span>{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
