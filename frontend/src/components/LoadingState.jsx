import { motion } from 'framer-motion';
import { Brain, FileSearch, Cpu } from 'lucide-react';

export default function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full p-10 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
    >
      <div className="flex flex-col items-center text-center">
        {/* Animated icon */}
        <div className="relative mb-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-primary"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Analyzing your document...
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
          Our AI is reading through your document and finding the best answer for your question.
        </p>

        {/* Skeleton loaders */}
        <div className="w-full space-y-3">
          {[100, 85, 95, 70].map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.15 }}
              className="flex gap-3"
            >
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                className="h-3.5 rounded-full bg-slate-200 dark:bg-slate-700"
                style={{ width: `${w}%` }}
              />
            </motion.div>
          ))}
        </div>

        {/* Steps */}
        <div className="mt-8 flex items-center gap-6 text-xs text-slate-400">
          {[
            { icon: FileSearch, label: 'Reading' },
            { icon: Cpu, label: 'Processing' },
            { icon: Brain, label: 'Generating' },
          ].map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.3 }}
              className="flex items-center gap-1.5"
            >
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
              >
                <step.icon className="w-3.5 h-3.5" />
              </motion.div>
              <span>{step.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
