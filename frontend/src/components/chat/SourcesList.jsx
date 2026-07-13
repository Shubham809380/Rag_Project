import { motion } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';

export default function SourcesList({ sources = [], onPreview }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        Sources
      </p>
      <div className="flex flex-col gap-1.5">
        {sources.map((src, i) => (
          <motion.button
            key={i}
            whileHover={{ x: 2 }}
            onClick={() => onPreview?.(src)}
            className="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg transition-colors focus-ring"
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
              <FileText size={13} style={{ color: '#3B82F6' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-fg truncate">{src.document}</span>
                {src.page ? <span className="text-[10px] shrink-0" style={{ color: '#64748B' }}>pg. {src.page}</span> : null}
              </div>
              {src.section && (
                <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{src.section}</p>
              )}
            </div>
            <ExternalLink size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#64748B' }} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
