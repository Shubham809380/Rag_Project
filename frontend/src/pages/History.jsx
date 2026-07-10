import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, FileText, Search, Trash2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { getHistory } from '../services/api';
import { formatDate, truncate } from '../utils/helpers';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getHistory();
      setHistory(Array.isArray(data) ? data : data.history || []);
    } catch {
      toast.error('Failed to load history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = history.filter(
    (item) =>
      item.question?.toLowerCase().includes(search.toLowerCase()) ||
      item.fileName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg dark:bg-slate-950">
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-slate-800 dark:text-white' }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Analysis History</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Browse and search through your previous document analyses.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-6"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by question or file name..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </motion.div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/50 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              {search ? 'No results found' : 'No history yet'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {search ? 'Try a different search term' : 'Your analysis history will appear here'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, i) => (
              <motion.div
                key={item.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      {truncate(item.question, 80)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      {item.fileName || 'Document'}
                    </p>
                    {item.answer && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2">
                        {truncate(item.answer, 120)}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-2">{formatDate(item.date || item.createdAt)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
