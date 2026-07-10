import { motion } from 'framer-motion';
import { promptTemplates } from '../utils/templates';

export default function PromptTemplates({ selected, onSelect }) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Prompt Template
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {promptTemplates.map((template) => {
          const Icon = template.icon;
          const isActive = selected === template.id;
          return (
            <motion.button
              key={template.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(template.id)}
              className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                isActive
                  ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 hover:border-primary/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>
                  {template.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2">
                {template.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
