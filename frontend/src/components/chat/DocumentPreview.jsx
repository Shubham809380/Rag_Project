import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';

export default function DocumentPreview({ source, isOpen, onClose }) {
  const [expanded, setExpanded] = useState(false);

  if (!source) return null;

  const panelContent = (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-sidebar)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
            <FileText size={14} style={{ color: '#3B82F6' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg truncate">{source.document}</p>
            {source.page && <p className="text-[11px]" style={{ color: '#64748B' }}>Page {source.page}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-card-hover transition-colors hidden md:block"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-card-hover transition-colors" title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {source.section && (
          <div className="mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Section</span>
            <p className="text-sm font-medium text-fg mt-1">{source.section}</p>
          </div>
        )}
        <div className="mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Matched Content</span>
        </div>
        <div
          className="rounded-xl p-4 text-sm leading-relaxed"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
          }}
        >
          {source.excerpt || 'Content preview not available for this source.'}
        </div>
        {source.score && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px]" style={{ color: '#64748B' }}>Relevance</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(source.score * 100)}%`,
                  background: 'linear-gradient(90deg, #3B82F6, #22D3EE)',
                }}
              />
            </div>
            <span className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>
              {Math.round(source.score * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: expanded ? 480 : 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="hidden md:block h-full shrink-0 overflow-hidden"
            style={{ borderLeft: '1px solid rgba(148,163,184,0.1)' }}
          >
            {panelContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 top-12 z-50 md:hidden rounded-t-2xl overflow-hidden"
            >
              {panelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
