import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Trash2, X, Calendar, Database, CloudUpload } from 'lucide-react';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFileColor(name) {
  if (name.endsWith('.pdf')) return '#EF4444';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return '#3B82F6';
  if (name.endsWith('.txt')) return '#94A3B8';
  if (name.endsWith('.csv')) return '#22C55E';
  if (name.endsWith('.md')) return '#8B5CF6';
  return '#94A3B8';
}

export default function DocumentPanel({ documents = [], onDelete, isOpen, onClose, onUpload, uploadProgress }) {
  const [confirmId, setConfirmId] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const localFileInputRef = useRef(null);

  const openFilePicker = () => localFileInputRef.current?.click();

  const handleLocalFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    onUpload?.(file);
  };

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onUpload?.(file);
  }, [onUpload]);

  const handleDelete = (doc) => {
    if (confirmId === doc.id) { onDelete(doc.id); setConfirmId(null); }
    else { setConfirmId(doc.id); }
  };

  const panelContent = (
    <div className="h-full flex flex-col" style={{ width: 340, minWidth: 340, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-default)' }}>
      {/* Hidden file input */}
      <input
        ref={localFileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt,.csv"
        onChange={handleLocalFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-heading">Documents</h2>
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6' }}>
            {documents.length}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-card-hover transition-colors" title="Close documents">
          <X size={16} />
        </button>
      </div>

      {/* Upload area */}
      <div className="px-4 py-3 shrink-0">
        {uploadProgress != null ? (
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-input)' }}>
            <div className="flex items-center gap-2 mb-2">
              <CloudUpload size={16} className="animate-bounce" style={{ color: '#3B82F6' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Uploading... {uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #3B82F6, #22D3EE)' }} />
            </div>
          </div>
        ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFilePicker}
          className="flex flex-col items-center gap-2 rounded-xl p-5 cursor-pointer transition-all group"
          style={{
            background: isDragOver ? 'rgba(59,130,246,0.08)' : 'var(--bg-input)',
            border: `2px dashed ${isDragOver ? '#3B82F6' : 'var(--border-default)'}`,
          }}
        >
          <CloudUpload size={26} style={{ color: isDragOver ? '#3B82F6' : '#475569' }} className="transition-colors" />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: isDragOver ? '#E2E8F0' : '#94A3B8' }}>
              Drop file or click to upload
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
              PDF, DOCX, TXT, CSV &middot; Max 20MB
            </p>
          </div>
        </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <FileText size={22} style={{ color: '#334155' }} />
            </div>
            <p className="text-sm" style={{ color: '#64748B' }}>No documents uploaded yet</p>
          </div>
        ) : (
          <div className="px-3 py-2 space-y-1">
            {documents.map((doc) => {
              const color = getFileColor(doc.file_name);
              const isConfirming = confirmId === doc.id;
              return (
                <div
                  key={doc.id}
                  className="group rounded-xl p-3 transition-colors"
                  style={{
                    background: isConfirming ? 'rgba(239,68,68,0.05)' : 'transparent',
                    borderLeft: isConfirming ? '2px solid #EF4444' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (!isConfirming) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={(e) => { if (!isConfirming) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12` }}>
                      <FileText size={16} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg truncate" title={doc.file_name}>{doc.file_name}</p>
                      <div className="flex items-center gap-2.5 mt-1 text-[10px]" style={{ color: '#475569' }}>
                        <span className="flex items-center gap-1"><Database size={10} />{doc.chunk_count} chunks</span>
                        <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(doc.created_at)}</span>
                      </div>
                      <div className="mt-1.5">
                        {isConfirming ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px]" style={{ color: '#94A3B8' }}>Delete?</span>
                            <button onClick={() => handleDelete(doc)} className="px-2 py-0.5 text-[11px] font-medium rounded text-white" style={{ background: '#EF4444' }}>Yes</button>
                            <button onClick={() => setConfirmId(null)} className="px-2 py-0.5 text-[11px] font-medium rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDelete(doc)}
                            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-all"
                            style={{ color: '#EF4444' }}
                          >
                            <Trash2 size={10} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="hidden md:block h-full shrink-0 overflow-hidden"
          >
            {panelContent}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
              className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.6)' }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 md:hidden">
              {panelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
