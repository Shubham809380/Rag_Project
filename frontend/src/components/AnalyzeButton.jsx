import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';

export default function AnalyzeButton({ onClick, loading, disabled }) {
  return (
    <motion.button
      whileHover={!loading && !disabled ? { scale: 1.02 } : {}}
      whileTap={!loading && !disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={loading || disabled}
      className={`w-full py-4 px-8 rounded-2xl font-semibold text-white text-base transition-all duration-300 flex items-center justify-center gap-2.5 ${
        loading || disabled
          ? 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed'
          : 'bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5'
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Analyzing...
        </>
      ) : (
        <>
          <Sparkles className="w-5 h-5" />
          Analyze Document
        </>
      )}
    </motion.button>
  );
}
