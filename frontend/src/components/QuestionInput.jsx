import { motion } from 'framer-motion';

export default function QuestionInput({ value, onChange, disabled, placeholder }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Your Question
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        placeholder={placeholder || "Ask anything about your uploaded document..."}
        className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none transition-all duration-200 text-base disabled:opacity-50"
      />
      <div className="mt-1.5 text-right">
        <span className="text-xs text-slate-400">{value.length} characters</span>
      </div>
    </motion.div>
  );
}
