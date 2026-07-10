import { motion } from 'framer-motion';
import { Home, ArrowLeft } from 'lucide-react';
import { Link, useRouteError } from 'react-router-dom';

export default function NotFound() {
  const error = useRouteError();

  return (
    <div className="min-h-screen bg-bg dark:bg-slate-950 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 0.1 }}
          className="text-8xl sm:text-9xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4"
        >
          {error?.status || 404}
        </motion.div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
          {error?.status === 404 ? 'Page Not Found' : 'Something went wrong'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
          {error?.status === 404
            ? "The page you're looking for doesn't exist or has been moved."
            : error?.message || 'An unexpected error occurred.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </motion.button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
