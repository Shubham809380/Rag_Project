import { motion, AnimatePresence } from 'framer-motion';
import { Clock, FileText, ChevronRight, X } from 'lucide-react';
import { formatDate, truncate } from '../utils/helpers';

export default function HistorySidebar({ history, onSelect, isOpen, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : '100%',
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 
          lg:static lg:translate-x-0 lg:shadow-none lg:border-l lg:rounded-2xl lg:h-auto lg:w-full
          ${isOpen ? 'lg:block' : 'lg:hidden'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Recent Analyses
            </h3>
            <button
              onClick={onClose}
              className="lg:hidden w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No analyses yet</p>
                <p className="text-xs text-slate-400 mt-1">Your history will appear here</p>
              </div>
            ) : (
              history.map((item, i) => (
                <motion.button
                  key={item.id || i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ x: -2 }}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="w-full text-left p-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {truncate(item.question, 45)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {item.fileName || 'Document'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(item.date || item.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}
