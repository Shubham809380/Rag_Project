import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Eye, ChevronDown, ChevronUp } from 'lucide-react';

export default function DocumentPreview({ fileName, fileId }) {
  const [expanded, setExpanded] = useState(false);

  if (!fileId) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="w-full"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Document Preview
          </span>
          <span className="text-xs text-slate-400">— {fileName}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 400 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-2 rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800"
          >
            <div className="w-full h-[400px] flex items-center justify-center bg-slate-100 dark:bg-slate-900">
              <div className="text-center p-8">
                <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{fileName}</p>
                <p className="text-xs text-slate-400 mt-1">Document indexed successfully</p>
                <div className="mt-4 flex items-center gap-2 justify-center">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs text-success font-medium">Ready for analysis</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
