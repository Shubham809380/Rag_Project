import { useEffect, useState } from 'react';
import {
  Code2,
  Play,
  Sparkles,
  LoaderCircle as Loader2,
  Cpu,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { executeSovereignCode, generateSovereignCode, getSovereignStatus } from '../../services/sovereign';

const DEFAULT_CODE = `def fibonacci(n: int) -> list[int]:
    """Return the first n Fibonacci numbers."""
    if n <= 0:
        return []
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

if __name__ == "__main__":
    print(fibonacci(10))
`;

const DEFAULT_TESTS = `from solution import fibonacci

def test_fibonacci_basic():
    assert fibonacci(0) == []
    assert fibonacci(1) == [0]
    assert fibonacci(2) == [0, 1]

def test_fibonacci_ten():
    result = fibonacci(10)
    assert result == [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
`;

const EXAMPLE_PROMPTS = [
  'Calculate prime numbers up to 100',
  'Write a function that converts Celsius to Fahrenheit and print a conversion table',
  'Create a simple calculator that adds, subtracts, multiplies and divides two numbers',
  'Generate a bar chart of monthly sales data using only print (no libraries)',
];

export default function SovereignCoding() {
  const [mode, setMode] = useState('ai');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [tests, setTests] = useState(DEFAULT_TESTS);
  const [testsTouched, setTestsTouched] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await getSovereignStatus();
        if (active) setStatus(s);
      } catch {
        // non-critical
      } finally {
        if (active) setStatusLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const sandbox = status?.sandbox || {};
  const dockerAvailable = sandbox.dockerAvailable === true;
  const hostFallback = sandbox.hostFallback === true && !dockerAvailable;

  const codingModel = (status?.models || [])
    .filter(m => m.profile === 'small' || /_local$/.test(m.key || ''))
    .find(m => m.role === 'coding' || m.role === 'reasoning') || {};
  const ollamaModelName = codingModel.modelId || codingModel.name || 'auto';

  const handleRun = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setAiResult(null);
    try {
      const r = await executeSovereignCode(code, tests || undefined, undefined);
      setResult(r);
    } catch (e) {
      setResult({
        ok: false,
        stdout: '',
        stderr: e?.response?.data?.error || e?.message || 'Execution request failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    setAiResult(null);
    try {
      const r = await generateSovereignCode(prompt, testsTouched ? tests : undefined);
      setAiResult(r);
      if (r.code) setCode(r.code);
      if (r.run) setResult(r.run);
    } catch (e) {
      setResult({
        ok: false,
        stdout: '',
        stderr: e?.response?.data?.error || e?.response?.data?.run?.error || e?.message || 'Generation failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const output = (result?.stdout || '') + (result?.stderr ? '\n--- stderr ---\n' + result.stderr : '');
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasOutput = result && (result.stdout || result.stderr || result.summary);

  return (
    <div className="p-6 space-y-6 max-w-[1100px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Code2 size={18} style={{ color: '#10B981' }} />
          <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-heading)' }}>Python Toolkit</h1>
        </div>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
          AI mode: describe what you need in plain English, Ollama writes the code and runs it. Direct mode: write your own Python.
        </p>
      </div>

      {/* Sandbox status strip */}
      <div
        className="rounded-lg border px-4 py-2.5 flex items-center gap-2 text-[12px] font-medium"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        {statusLoading ? (
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        ) : dockerAvailable ? (
          <>
            <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
            <span style={{ color: '#10B981' }}>Docker sandbox available</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>Ollama model: {ollamaModelName}</span>
          </>
        ) : hostFallback ? (
          <>
            <span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#F59E0B' }}>Docker unavailable — host fallback active (unprotected process)</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>Ollama model: {ollamaModelName}</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />
            <span style={{ color: '#F59E0B' }}>Sandbox not configured — execution unavailable</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>Set SOVEREIGN_HOST_FALLBACK=true in .env to enable local execution</span>
          </>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('ai')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
          style={{
            background: mode === 'ai' ? 'linear-gradient(135deg,#8B5CF6,#3B82F6)' : 'var(--bg-card)',
            color: mode === 'ai' ? '#fff' : 'var(--text-secondary)',
            border: mode === 'ai' ? '1px solid transparent' : '1px solid var(--border-subtle)',
          }}
        >
          <Sparkles size={14} /> AI Generate
        </button>
        <button
          onClick={() => setMode('direct')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
          style={{
            background: mode === 'direct' ? '#10B981' : 'var(--bg-card)',
            color: mode === 'direct' ? '#fff' : 'var(--text-secondary)',
            border: mode === 'direct' ? '1px solid transparent' : '1px solid var(--border-subtle)',
          }}
        >
          <Code2 size={14} /> Direct Code
        </button>
      </div>

      {/* AI mode: prompt input */}
      {mode === 'ai' && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-muted)' }}>
            Describe what you need (Ollama generates the Python code)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && prompt.trim() && !loading) { e.preventDefault(); handleGenerate(); } }}
            spellCheck={false}
            placeholder="e.g. Write a program to calculate the factorial of numbers 1 to 20 and print them in a table"
            className="w-full text-[13px] leading-relaxed rounded-lg border px-3 py-3 resize-y focus:outline-none focus:ring-1 min-h-24"
            style={{
              background: 'var(--bg-base)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)', color: '#fff' }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><Sparkles size={16} /> Generate & Run</>}
            </button>
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                className="px-2.5 py-1 rounded border text-[11px] transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)', background: 'var(--bg-base)' }}
              >
                {ex}
              </button>
            ))}
          </div>
          {aiResult?.model && (
            <div className="mt-2 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              Generated by <span style={{ color: '#8B5CF6' }}>{aiResult.model}</span>
            </div>
          )}
        </div>
      )}

      {/* Generated code (shown in AI mode) */}
      {mode === 'ai' && aiResult?.code && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8B5CF6' }}>
              Generated Code
            </label>
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {aiResult.code.split('\n').length} lines
            </span>
          </div>
          <pre
            className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap rounded-lg border px-3 py-3 overflow-auto max-h-64"
            style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            {aiResult.code}
          </pre>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { setCode(aiResult.code); setMode('direct'); }}
              className="text-[11px] font-medium px-2.5 py-1 rounded border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Edit in Direct mode
            </button>
          </div>
        </div>
      )}

      {/* Direct mode: code editor + tests */}
      {mode === 'direct' && (
        <>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-muted)' }}>
              Python Code
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full font-mono text-[12px] leading-relaxed rounded-lg border px-3 py-3 resize-y focus:outline-none focus:ring-1 min-h-56"
              style={{
                background: 'var(--bg-base)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                tabSize: 4,
              }}
            />
          </div>

          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-muted)' }}>
              Unit Test Code (optional, pytest-style)
            </label>
            <textarea
              value={tests}
              onChange={(e) => { setTestsTouched(true); setTests(e.target.value); }}
              spellCheck={false}
              className="w-full font-mono text-[12px] leading-relaxed rounded-lg border px-3 py-3 resize-y focus:outline-none focus:ring-1 min-h-32"
              style={{
                background: 'var(--bg-base)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                tabSize: 4,
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={!code.trim() || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: '#10B981', color: '#fff' }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Executing…</> : <><Play size={16} /> Run</>}
            </button>
            {hasOutput && (
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
              >
                {copied ? <Check size={13} style={{ color: '#10B981' }} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy output'}
              </button>
            )}
          </div>
        </>
      )}

      {/* Output panel */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          borderColor: result
            ? result.ok
              ? 'rgba(16,185,129,0.4)'
              : 'rgba(239,68,68,0.4)'
            : 'var(--border-subtle)',
        }}
      >
        <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Cpu size={14} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Output</span>
          </div>
          {result && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold"
              style={{
                color: result.ok ? '#10B981' : '#EF4444',
                background: result.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              }}
            >
              {result.ok ? 'SUCCESS' : 'FAILED'}
              {result.fallback === 'host' && ' · HOST'}
            </span>
          )}
        </div>
        <div className="p-4 min-h-[120px]">
          {hasOutput ? (
            <div className="space-y-3">
              {result.stdout && (
                <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                  {result.stdout}
                </pre>
              )}
              {result.stderr && (
                <div className="mt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#EF4444' }}>stderr</div>
                  <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: '#FCA5A5' }}>
                    {result.stderr}
                  </pre>
                </div>
              )}
              {result.summary && (
                <div
                  className="mt-3 px-3 py-2 rounded-lg border text-[12px]"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap" style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    {(Array.isArray(result.summary) ? result.summary : [result.summary]).join('\n')}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-center py-4" style={{ color: 'var(--text-muted)' }}>
              {mode === 'ai'
                ? 'Describe what you need above — Ollama writes the code and shows the output here.'
                : 'Output will appear here after you click Run.'}
            </p>
          )}
        </div>
      </div>

      {/* Error strip */}
      {result && !result.ok && !result.stdout && !result.stderr && result.stderr !== '' && (
        <div
          className="rounded-xl border p-4 flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}
        >
          <AlertTriangle size={18} style={{ color: '#EF4444', marginTop: 1 }} />
          <div>
            <div className="text-[12px] font-semibold" style={{ color: '#EF4444' }}>Execution failed</div>
            <div className="text-[12px] mt-1 font-mono" style={{ color: '#FCA5A5' }}>
              {result.stderr || result.error || 'No output returned'}
            </div>
          </div>
        </div>
      )}

      {/* Footer honesty note */}
      <div className="text-[11px] pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        {hostFallback
          ? 'Execution is time-boxed and memory-capped, but is running on the host Python interpreter (no Docker isolation). Code is still gated by the static guard, and results are marked HOST.'
          : 'Execution is time-boxed, memory-capped, and the container has no network adapter. Code is generated locally by Ollama — nothing leaves your machine.'}
      </div>
    </div>
  );
}