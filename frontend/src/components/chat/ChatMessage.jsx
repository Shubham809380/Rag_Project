import { useState } from "react";
import { motion } from "framer-motion";
import { User, Bot, Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, AlertTriangle } from "lucide-react";
import SourcesList from "./SourcesList";

function renderInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    let first = null, firstIdx = Infinity;
    if (codeMatch && codeMatch.index < firstIdx) { first = { t: "code", m: codeMatch }; firstIdx = codeMatch.index; }
    if (boldMatch && boldMatch.index < firstIdx) { first = { t: "bold", m: boldMatch }; firstIdx = boldMatch.index; }
    if (italicMatch && italicMatch.index < firstIdx) { first = { t: "italic", m: italicMatch }; firstIdx = italicMatch.index; }
    if (!first) { parts.push(<span key={key++}>{remaining}</span>); break; }
    if (firstIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, firstIdx)}</span>);
    if (first.t === "code") parts.push(    <code key={key++} className="px-1.5 py-0.5 rounded text-[12px] font-mono" style={{ background: 'rgba(34,211,238,0.08)', color: '#22D3EE' }}>{first.m[1]}</code>);
    else if (first.t === "bold") parts.push(<strong key={key++} className="font-semibold" style={{ color: 'var(--text-heading)' }}>{first.m[1]}</strong>);
    else if (first.t === "italic") parts.push(<em key={key++} className="italic" style={{ color: 'var(--text-secondary)' }}>{first.m[1]}</em>);
    remaining = remaining.slice(firstIdx + first.m[0].length);
  }
  return parts;
}

function renderAssistantContent(content) {
  const paragraphs = content.split("\n\n");
  const elements = [];
  let key = 0;
  for (const para of paragraphs) {
    const lines = para.split("\n");
    const listItems = [];
    let isBullet = false, isNum = false;
    let nonList = [];
    for (const line of lines) {
      const t = line.trim();
      if (/^[-*]\s/.test(t)) {
        if (!isBullet && !isNum && nonList.length > 0) { elements.push(<p key={key++} className="mb-1.5">{nonList.map((l, i) => <span key={i}>{renderInline(l)}{i < nonList.length - 1 && <br />}</span>)}</p>); nonList = []; }
        isBullet = true;
        listItems.push(<li key={key++} className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: '#3B82F6' }} /><span>{renderInline(t.replace(/^[-*]\s/, ""))}</span></li>);
      } else if (/^\d+\.\s/.test(t)) {
        if (!isBullet && !isNum && nonList.length > 0) { elements.push(<p key={key++} className="mb-1.5">{nonList.map((l, i) => <span key={i}>{renderInline(l)}{i < nonList.length - 1 && <br />}</span>)}</p>); nonList = []; }
        isNum = true;
        const num = t.match(/^(\d+)\.\s/)[1];
        listItems.push(<li key={key++} className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-[11px] font-semibold" style={{ color: '#3B82F6' }}>{num}.</span><span>{renderInline(t.replace(/^\d+\.\s/, ""))}</span></li>);
      } else {
        if (isBullet || isNum) { elements.push(<ul key={key++} className="mb-1.5 space-y-0.5 list-none">{listItems}</ul>); listItems.length = 0; isBullet = false; isNum = false; }
        nonList.push(line);
      }
    }
    if (listItems.length > 0) elements.push(<ul key={key++} className="mb-1.5 space-y-0.5 list-none">{listItems}</ul>);
    if (nonList.length > 0) elements.push(<p key={key++} className="mb-1.5 leading-relaxed">{nonList.map((l, i) => <span key={i}>{renderInline(l)}{i < nonList.length - 1 && <br />}</span>)}</p>);
  }
  return elements;
}

function ConfidenceBadge({ confidence }) {
  if (!confidence) return null;
  const s = { high: { bg: 'rgba(34,197,94,0.1)', c: '#22C55E', b: 'rgba(34,197,94,0.2)' }, medium: { bg: 'rgba(245,158,11,0.1)', c: '#F59E0B', b: 'rgba(245,158,11,0.2)' }, low: { bg: 'rgba(239,68,68,0.1)', c: '#EF4444', b: 'rgba(239,68,68,0.2)' } }[confidence] || { bg: 'rgba(239,68,68,0.1)', c: '#EF4444', b: 'rgba(239,68,68,0.2)' };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: s.bg, color: s.c, border: `1px solid ${s.b}` }}>
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
    </span>
  );
}

function ActionButton({ icon: Icon, label, onClick, active, activeColor }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="p-1.5 rounded-md transition-colors focus-ring"
      style={{ color: active ? activeColor : '#475569' }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={14} />
    </button>
  );
}

export default function ChatMessage({ role, content, isLast, sources, confidence, followUps, onSend, onPreviewSource, isError, onRetry }) {
  const isUser = role === "user";
  const safeContent = content || '';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(safeContent); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: isUser ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'linear-gradient(135deg, #1E293B, #334155)' }}>
        {isUser ? <User size={13} className="text-white" /> : <Bot size={13} style={{ color: '#94A3B8' }} />}
      </div>

      {/* Content */}
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[82%]`}>
        <div className="px-3.5 py-2.5 text-[13.5px] leading-relaxed rounded-2xl"
          style={{
            background: isError ? 'rgba(239,68,68,0.06)' : isUser ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'var(--bg-card)',
            color: isUser ? '#FFFFFF' : 'var(--text-secondary)',
            border: isError ? '1px solid rgba(239,68,68,0.15)' : isUser ? 'none' : '1px solid var(--border-subtle)',
            borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          }}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{safeContent}</span>
          ) : isError ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
                <span style={{ color: '#EF4444' }}>{safeContent}</span>
              </div>
              {onRetry && (
                <button onClick={onRetry}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all focus-ring"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}>
                  <RotateCcw size={12} /> Retry
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-0 markdown-body">
              {renderAssistantContent(safeContent)}
              {isLast && <span className="typing-cursor" />}
            </div>
          )}
        </div>

        {/* Metadata */}
        {!isUser && !isLast && (
          <div className="w-full max-w-xl mt-1.5 px-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <ConfidenceBadge confidence={confidence} />
              <div className="flex items-center gap-0.5 ml-auto">
                <ActionButton icon={copied ? Check : Copy} label="Copy" onClick={handleCopy} active={copied} activeColor="#22C55E" />
                <ActionButton icon={ThumbsUp} label="Helpful" onClick={() => setFeedback(feedback === 'up' ? null : 'up')} active={feedback === 'up'} activeColor="#22C55E" />
                <ActionButton icon={ThumbsDown} label="Not helpful" onClick={() => setFeedback(feedback === 'down' ? null : 'down')} active={feedback === 'down'} activeColor="#EF4444" />
              </div>
            </div>
            <SourcesList sources={sources} onPreview={onPreviewSource} />
            {followUps && followUps.length > 0 && (
              <div className="mt-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Suggested</p>
                <div className="flex flex-wrap gap-1.5">
                  {followUps.map((q, i) => (
                    <button key={i} onClick={() => onSend?.(q)} aria-label={`Ask: ${q}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-left focus-ring"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#E2E8F0'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.08)'; e.currentTarget.style.color = '#94A3B8'; }}
                    >
                      <RotateCcw size={10} />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
