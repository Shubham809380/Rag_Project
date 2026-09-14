import { useState, useRef, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { Badge, Select, PrimaryButton, Spinner } from '../components/common/ui';
import Markdown from '../components/common/Markdown';
import { useDocuments, useKnowledgeBases } from '../hooks/useCatalog';
import { runAgent } from '../services/api';
import { useLanguage } from '../i18n';

export default function AssistantPage() {
  const { documents } = useDocuments();
  const { kbs } = useKnowledgeBases();
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [kbId, setKbId] = useState('');
  const [fileId, setFileId] = useState('');
  const [activities, setActivities] = useState([]);
  const [showSources] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    setActivities([]);
    try {
      const res = await runAgent({ question: text, knowledgeBaseId: kbId || null, fileId: fileId || null, settings: {} });
      if (!res.success) throw new Error(res.message || 'Agent failed');
      setMessages((m) => [...m, { role: 'assistant', content: res.answer, sources: res.sources || [], tools: res.tools || [], activities: res.activities || [] }]);
      setActivities(res.activities || []);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, the agent encountered an error.', isError: true }]);
    } finally { setBusy(false); }
  };

  return (
    <AppLayout title={t('aiAssistant')}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' } }} />
      <div className="h-full flex flex-col max-w-4xl mx-auto p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-2 text-fg-muted text-sm"><Sparkles size={15} style={{ color: '#8B5CF6' }} /> <b className="text-fg">Agentic AI</b> — plans, retrieves, and uses tools to answer</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Select value={kbId} onChange={(e) => setKbId(e.target.value)} className="flex-1 min-w-[180px] max-w-[260px]">
            <option value="">All knowledge</option>
            {kbs.map((kb) => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
          </Select>
          <Select value={fileId} onChange={(e) => { setFileId(e.target.value); setKbId(''); }} className="flex-1 min-w-[180px] max-w-[260px]">
            <option value="">All documents</option>
            {documents.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          {messages.length === 0 && !busy && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(139,92,246,0.1)' }}>
                <Bot size={26} style={{ color: '#8B5CF6' }} />
              </div>
              <p className="text-lg font-semibold text-heading mb-2">Ask the Agentic AI Assistant</p>
              <p className="text-sm text-fg-muted max-w-md">It searches your knowledge base, uses the web when needed, calculates, compares, and converts the task into a clear plan.</p>
            </div>
          )}

          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${m.role === 'user' ? '' : 'w-full'}`}>
                <div className={`flex items-center gap-2 mb-1 ${m.role === 'user' ? 'justify-end' : ''}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                    {m.role === 'user' ? 'You' : 'Agent'}
                  </span>
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'text-white' : ''}`}
                  style={m.role === 'user'
                    ? { background: 'linear-gradient(135deg, #3B82F6, #22D3EE)' }
                    : { background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
                >
                  {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : <div className="whitespace-pre-wrap">{m.content}</div>}
                </div>
                {m.role === 'assistant' && m.tools?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.tools.map((tm, i) => <Badge key={i} color={tm === 'web_search' ? '#F59E0B' : '#3B82F6'}>{tm}</Badge>)}
                  </div>
                )}
                {m.role === 'assistant' && m.sources?.length > 0 && showSources && (
                  <div className="mt-2 rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                    <p className="text-[11px] font-semibold text-fg-muted uppercase mb-1.5">Sources ({m.sources.length})</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {m.sources.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-[12px] text-fg-muted">
                          <Badge color={s.type === 'web' ? '#F59E0B' : '#3B82F6'}>{s.type === 'web' ? 'Web' : 'KB'}</Badge>
                          <span className="flex-1">{s.document}{s.page ? ` · p${s.page}` : ''}</span>
                          {s.url && <a className="text-primary underline" href={s.url} target="_blank" rel="noreferrer">link</a>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-3 text-sm text-fg-muted">
              <Spinner size={16} />
              {activities.length > 0 ? activities.filter((a) => a.status === 'running').map((a) => a.id).join(', ') : 'Working...'}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <textarea ref={inputRef} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask the agent anything..."
            rows={1}
            className="flex-1 resize-none rounded-xl border bg-input px-4 py-3 text-sm text-fg placeholder:text-fg-muted focus-ring outline-none"
            style={{ borderColor: 'var(--border-default)' }} />
          <PrimaryButton onClick={send} disabled={busy || !input.trim()} className="!p-3">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </PrimaryButton>
        </div>
      </div>
    </AppLayout>
  );
}
