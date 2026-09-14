import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { GraduationCap, Loader2, RotateCcw } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { Card, PageHeader, PageLoader, PrimaryButton, GhostButton, Select, Badge } from '../components/common/ui';
import Markdown from '../components/common/Markdown';
import { useDocuments } from '../hooks/useCatalog';
import { generateStudyMaterial, submitQuiz } from '../services/api';
import { useLanguage } from '../i18n';

const KINDS = [
  { id: 'mcq', label: 'MCQs' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'notes', label: 'Study Notes' },
  { id: 'summary', label: 'Summary' },
  { id: 'short_questions', label: 'Short Questions' },
  { id: 'long_questions', label: 'Long/Essay Questions' },
  { id: 'viva', label: 'Viva Questions' },
  { id: 'important_topics', label: 'Important Topics' },
];

export default function StudyPage() {
  const { documents, loading } = useDocuments();
  const { t } = useLanguage();
  const [docId, setDocId] = useState('');
  const [kind, setKind] = useState('mcq');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(6);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [quizScore, setQuizScore] = useState(null);

  const run = async () => {
    if (!docId) return toast.error('Select a document');
    setRunning(true);
    setResult(null);
    setSelectedAnswers({});
    setShowResults(false);
    setQuizScore(null);
    try {
      const res = await generateStudyMaterial({ documentId: docId, kind, difficulty, count });
      if (res.success) setResult(res);
      else toast.error(res.message || 'Failed to generate study material');
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setRunning(false); }
  };

  const selectAnswer = (qIdx, optIdx) => setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));

  const checkQuiz = async () => {
    if (!result?.quizId) return;
    const answers = Object.keys(selectedAnswers).map((k) => selectedAnswers[k]);
    try {
      const res = await submitQuiz(result.quizId, answers);
      setQuizScore(res);
      setShowResults(true);
    } catch { toast.error('Failed to submit quiz'); }
  };

  const questions = result?.content?.questions || [];

  return (
    <AppLayout title={t('studyMode')}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' } }} />
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader title={t('studyMode')} subtitle="Turn any document into flashcards, quizzes and study notes" />

        <Card className="mb-6">
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-fg mb-1">Document</label>
              <Select value={docId} onChange={(e) => setDocId(e.target.value)} className="w-full">
                <option value="">Select a document</option>
                {documents.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-1">{t('studyKind')}</label>
              <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">
                {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-1">{t('difficulty')}</label>
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full">
                {['easy', 'medium', 'hard'].map((d) => <option key={d} value={d}>{t(d)}</option>)}
              </Select>
            </div>
          </div>
          {kind === 'mcq' && (
            <div className="mt-4 flex items-center gap-2">
              <label className="text-sm font-medium text-fg">Questions:</label>
              <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[4, 6, 8, 10, 12].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          )}
          <PrimaryButton onClick={run} disabled={running || !docId} className="mt-4 w-full">
            {running ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
            {running ? 'Generating...' : 'Generate Study Material'}
          </PrimaryButton>
        </Card>

        {loading && <PageLoader />}

        {result?.content?.markdown && (
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-heading">Study Material</h3>
              <GhostButton onClick={() => setResult(null)}><RotateCcw size={15} /> Reset</GhostButton>
            </div>
            <Markdown>{result.content.markdown}</Markdown>
          </Card>
        )}

        {result?.content?.flashcards && (
          <Flashcards cards={result.content.flashcards} />
        )}

        {/* MCQ / short questions */}
        {!result?.content?.markdown && questions.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-heading">{kind === 'mcq' ? 'Multiple Choice Quiz' : 'Questions'}</h3>
              {kind === 'mcq' && (
                <PrimaryButton onClick={checkQuiz} disabled={Object.keys(selectedAnswers).length < questions.length}>
                  {showResults ? 'Submitted' : 'Submit Answers'}
                </PrimaryButton>
              )}
              {showResults && quizScore && (
                <Badge color="#22C55E" bg="rgba(34,197,94,0.12)">Score: {quizScore.score}/{quizScore.total} ({quizScore.percent}%)</Badge>
              )}
            </div>
            <div className="space-y-5">
              {questions.map((q, qi) => (
                <div key={qi} className="border rounded-xl p-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="font-medium text-fg mb-2">{qi + 1}. {q.question}</p>

                  {kind === 'mcq' && q.options?.length > 0 && (
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => {
                        const isRight = showResults && oi === q.answer_index;
                        const isWrongPick = showResults && selectedAnswers[qi] === oi && oi !== q.answer_index;
                        return (
                          <button key={oi} onClick={() => !showResults && selectAnswer(qi, oi)}
                            className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors focus-ring ${showResults ? 'cursor-default' : 'cursor-pointer'}`}
                            style={{
                              border: `1px solid ${isRight ? '#22C55E' : isWrongPick ? '#EF4444' : 'var(--border-default)'}`,
                              background: isRight ? 'rgba(34,197,94,0.1)' : isWrongPick ? 'rgba(239,68,68,0.1)' : selectedAnswers[qi] === oi ? 'rgba(59,130,246,0.12)' : 'var(--bg-input)',
                              color: 'var(--text-fg)',
                            }}>
                            {opt}{showResults && isRight && ' ✓'}{showResults && isWrongPick && ' ✗'}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.answer && kind !== 'mcq' && (
                    <div className="mt-2 rounded-lg bg-input p-3 text-sm text-fg-muted">
                      <b>Answer:</b> {typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer)}
                    </div>
                  )}
                  {q.points?.length > 0 && (
                    <div className="mt-2 rounded-lg bg-input p-3 text-sm text-fg-muted">
                      <b>Key points:</b>
                      <ul className="list-disc pl-5 mt-1">{q.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                  )}
                  {q.explanation && kind === 'mcq' && showResults && (
                    <p className="mt-2 text-[13px] text-fg-muted"><b>Explanation:</b> {q.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function Flashcards({ cards }) {
  const [flipped, setFlipped] = useState({});
  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-6">
      {cards.map((c, i) => (
        <button key={i} onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
          className="rounded-2xl border bg-card p-5 text-left transition-colors focus-ring"
          style={{ borderColor: 'var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="text-[11px] font-semibold text-fg-muted uppercase mb-2">{flipped[i] ? 'Answer' : 'Question'}</div>
          {flipped[i] ? (
            <p className="text-sm text-fg">{c.back || c.answer}</p>
          ) : (
            <p className="font-medium text-heading">{c.front || c.question}</p>
          )}
          <div className="mt-3 text-[11px] text-fg-muted">Click to {flipped[i] ? 'show question' : 'reveal answer'}</div>
        </button>
      ))}
    </div>
  );
}
