import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Loader2, Bot, FileText, Lightbulb, ListChecks, GitCompare, Search, BookOpen, Paperclip, ArrowDown } from "lucide-react";
import ChatMessage from "./ChatMessage";
import { MessageSkeleton } from "../common/Skeleton";

const QUICK_ACTIONS = [
  { label: "Summarize", prompt: "Summarize the key points from my documents", desc: "Get a concise summary", icon: FileText, color: "#3B82F6" },
  { label: "Key points", prompt: "Extract the most important points from my documents", desc: "Extract important points", icon: ListChecks, color: "#8B5CF6" },
  { label: "Explain", prompt: "Explain the main concepts in my documents in simple terms", desc: "Clear explanation", icon: Lightbulb, color: "#22D3EE" },
  { label: "Compare", prompt: "Compare and contrast the information across my documents", desc: "Compare documents", icon: GitCompare, color: "#F59E0B" },
  { label: "Find quotes", prompt: "Find the most relevant quotes and passages from my documents", desc: "Locate specific passages", icon: Search, color: "#22C55E" },
  { label: "Deep dive", prompt: "Provide a comprehensive deep-dive analysis of my documents", desc: "Comprehensive analysis", icon: BookOpen, color: "#EC4899" },
];

function ScrollToBottom({ onClick, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          onClick={onClick} aria-label="Scroll to bottom"
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-colors focus-ring"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}>
          <ArrowDown size={16} style={{ color: 'var(--text-secondary)' }} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default function ChatView({ messages = [], onSend, isLoading, onOpenDocs, onPreviewSource }) {
  const [input, setInput] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const hasMessages = messages.length > 0;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll, hasMessages]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
    setTimeout(scrollToBottom, 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full relative" style={{ background: 'var(--bg-base)' }}>
      <AnimatePresence mode="wait">
        {!hasMessages ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-6 px-6 overflow-y-auto">
            {/* Logo */}
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, type: "spring", damping: 15 }}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #22D3EE)', boxShadow: '0 8px 32px rgba(59,130,246,0.3)' }}>
              <Bot size={36} className="text-white" />
            </motion.div>

            {/* Heading */}
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
              className="text-center max-w-lg">
              <h1 className="text-2xl sm:text-3xl font-bold text-heading mb-2.5 leading-tight">
                How can I help with your <span className="gradient-text">documents?</span>
              </h1>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Upload your documents and ask questions. InsightRAG will find grounded answers from your files.
              </p>
            </motion.div>

            {/* Upload CTA */}
            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-2">
              <button onClick={onOpenDocs}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all focus-ring"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', boxShadow: '0 2px 12px rgba(59,130,246,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(59,130,246,0.3)'; }}>
                <Paperclip size={16} />
                Upload your first document
              </button>
              <p className="text-[11px]" style={{ color: '#475569' }}>PDF &middot; DOCX &middot; TXT &middot; CSV &middot; Max 20MB</p>
            </motion.div>

            {/* Quick actions */}
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full max-w-2xl mt-2">
              {QUICK_ACTIONS.map((action, i) => (
                <motion.button key={action.label}
                  initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.45 + i * 0.05 }}
                  whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={() => onSend(action.prompt)}
                  className="flex items-center gap-3 rounded-xl p-3.5 text-left transition-all focus-ring"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${action.color}33`; e.currentTarget.style.boxShadow = `0 4px 12px ${action.color}10`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${action.color}12` }}>
                    <action.icon size={16} style={{ color: action.color }} />
                  </div>
                  <div>
                    <span className="text-[13px] font-semibold text-fg block">{action.label}</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{action.desc}</span>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <div ref={containerRef} className="flex-1 overflow-y-auto px-4 pb-4 pt-5">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((msg, i) => (
                <ChatMessage key={msg.id} role={msg.role} content={msg.content} isLast={i === messages.length - 1 && isLoading}
                  sources={msg.sources} confidence={msg.confidence} followUps={msg.followUps} onSend={onSend} onPreviewSource={onPreviewSource} />
              ))}
              {isLoading && <MessageSkeleton />}
              <div ref={messagesEndRef} />
            </div>
            <ScrollToBottom onClick={scrollToBottom} visible={!isAtBottom} />
          </div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0 px-4 sm:px-6 pb-4 pt-2" style={{ background: `linear-gradient(to top, var(--bg-base) 50%, transparent)` }}>
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2.5 rounded-2xl px-3.5 py-2.5 transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}>
            <TipButton icon={Paperclip} label="Attach file" onClick={onOpenDocs} />
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask about your documents..." rows={1} aria-label="Chat input"
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[14px] text-fg placeholder-fg-muted focus:outline-none leading-6" />
            <button onClick={handleSubmit} disabled={!input.trim() || isLoading} aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-all disabled:cursor-not-allowed disabled:opacity-25 focus-ring"
              style={{
                background: input.trim() && !isLoading ? 'linear-gradient(135deg, #3B82F6, #22D3EE)' : 'var(--bg-input)',
                boxShadow: input.trim() && !isLoading ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
              }}>
              {isLoading ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.5} />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Enter to send &middot; Shift+Enter for new line &middot; AI can make mistakes
          </p>
        </div>
      </div>
    </div>
  );
}

function TipButton({ icon: Icon, label, onClick }) {
  return (
    <span className="tooltip-wrapper">
      <button onClick={onClick} aria-label={label}
        className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-ring"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
        <Icon size={17} />
      </button>
      <span className="tooltip">{label}</span>
    </span>
  );
}
