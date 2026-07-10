import { motion } from 'framer-motion';
import { Brain, FileText, Zap, Shield, Globe, Cpu } from 'lucide-react';

const features = [
  { icon: Brain, title: 'AI-Powered', desc: 'Advanced AI models analyze your documents with high accuracy and contextual understanding.' },
  { icon: FileText, title: 'Multi-Format', desc: 'Support for PDF, DOCX, and TXT files up to 20MB in size.' },
  { icon: Zap, title: 'Lightning Fast', desc: 'Get answers in seconds with our optimized processing pipeline.' },
  { icon: Shield, title: 'Secure & Private', desc: 'Your documents are processed securely and never shared with third parties.' },
  { icon: Globe, title: 'Always Available', desc: 'Access from anywhere, on any device with our responsive web interface.' },
  { icon: Cpu, title: 'Smart Context', desc: 'Our AI understands document context and provides relevant, accurate answers.' },
];

export default function About() {
  return (
    <div className="min-h-screen bg-bg dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-4">
            About InsightRAG
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            We leverage cutting-edge AI technology to help you extract insights from your documents faster and more accurately than ever before.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="p-7 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Mission */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-16 p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10 text-center"
        >
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Our Mission</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            To make document analysis accessible, fast, and intelligent. We believe everyone should be able to
            quickly extract valuable information from their documents without spending hours reading through pages of content.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
