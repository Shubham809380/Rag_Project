import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FileText, Brain, Zap, Upload, MessageSquare, Shield,
  ArrowRight, Users, BookOpen, Code, Building2,
  Scale, BarChart3, FileSearch, CheckCircle, Globe,
  Sparkles, GitBranch
} from 'lucide-react';
import LandingNavbar from '../components/layout/LandingNavbar';
import LandingFooter from '../components/layout/LandingFooter';

const features = [
  { icon: Upload, title: 'Multi-File Upload', desc: 'Upload multiple documents at once with drag-and-drop support for quick and easy file management.' },
  { icon: MessageSquare, title: 'AI-Powered Q&A', desc: 'Ask natural language questions about your documents and get accurate, context-aware answers instantly.' },
  { icon: Brain, title: 'Context Understanding', desc: 'Advanced RAG technology ensures answers are grounded in your actual document content, not hallucinated.' },
  { icon: Zap, title: 'Fast Processing', desc: 'Documents are split, embedded, and indexed in seconds. Get answers almost instantly after upload.' },
  { icon: Shield, title: 'Secure Accounts', desc: 'Your data is protected with secure Google authentication and user-scoped document isolation.' },
  { icon: Globe, title: 'Responsive Design', desc: 'Use InsightRAG on any device — desktop, tablet, or mobile. Fully responsive interface.' },
  { icon: Sparkles, title: 'Prompt Templates', desc: 'Choose from built-in prompt templates for summarization, FAQ generation, key points extraction, and more.' },
  { icon: FileText, title: 'Multiple Formats', desc: 'Support for PDF, DOCX, TXT, and CSV files. Upload up to 10 documents, 20MB each, in a single session.' },
];

const steps = [
  { num: '01', icon: Upload, title: 'Upload Documents', desc: 'Drag and drop or browse to upload your PDF, DOCX, or TXT files. Multiple files supported.' },
  { num: '02', icon: MessageSquare, title: 'Ask Questions', desc: 'Type your question in natural language. Use prompt templates or ask anything specific.' },
  { num: '03', icon: Brain, title: 'Get AI Answers', desc: 'Receive accurate answers generated from your document content using advanced AI models.' },
];

const useCases = [
  { icon: BookOpen, title: 'Students', desc: 'Quickly extract key information from textbooks, research papers, and lecture notes.' },
  { icon: GitBranch, title: 'Researchers', desc: 'Analyze large volumes of academic papers and find relevant information fast.' },
  { icon: Code, title: 'Developers', desc: 'Query technical documentation, API references, and codebases with natural language.' },
  { icon: Building2, title: 'Business Teams', desc: 'Analyze reports, proposals, and business documents for faster decision-making.' },
  { icon: Users, title: 'HR Teams', desc: 'Search through policies, handbooks, and compliance documents efficiently.' },
  { icon: Scale, title: 'Legal Analysis', desc: 'Review contracts, legal documents, and regulatory filings with AI assistance.' },
  { icon: BarChart3, title: 'Finance Reports', desc: 'Extract insights from financial reports, statements, and market analyses.' },
  { icon: FileSearch, title: 'Policy Analysis', desc: 'Navigate complex policy documents and regulatory frameworks with ease.' },
];

const fileTypes = [
  { ext: 'PDF', color: 'from-red-500 to-orange-500' },
  { ext: 'TXT', color: 'from-slate-500 to-slate-400' },
  { ext: 'DOCX', color: 'from-blue-500 to-blue-400' },
  { ext: 'CSV', color: 'from-green-500 to-green-400' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg-base)' }}>
      <LandingNavbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-purple-500/8 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Document Intelligence
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight tracking-tight mb-6">
              Chat With Your{' '}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Documents
              </span>{' '}
              Using AI
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Upload multiple documents, ask questions, and get accurate AI-powered answers based on your files.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => document.querySelector('#preview')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 hover:bg-white/5 transition-all duration-300"
              >
                View Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Product Preview */}
      <section id="preview" className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl bg-slate-900/50 border border-slate-800/50 p-1 overflow-hidden"
          >
            <div className="rounded-2xl bg-slate-900 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {['document1.pdf', 'report.docx', 'notes.txt'].map((name) => (
                  <div key={name} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white truncate">{name}</p>
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Ready
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 mb-4">
                <p className="text-sm text-slate-400">Ask: What are the main findings in these documents?</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Based on the uploaded documents, the main findings include several key insights across all three files. The analysis reveals consistent patterns...
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Analyze Documents
              </span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Powerful features designed to help you extract insights from your documents faster than ever.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/50 hover:border-blue-500/30 hover:bg-slate-900/80 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              How It{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Works
              </span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Get started in three simple steps. No complex setup required.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            <div className="hidden sm:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-blue-500/0 via-blue-500/30 to-blue-500/0" />
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center relative"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-6 relative z-10">
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported File Types */}
      <section className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-8">Supported File Types</h2>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
              {fileTypes.map((ft) => (
                <div
                  key={ft.ext}
                  className={`px-6 py-3 rounded-2xl bg-gradient-to-r ${ft.color} text-white font-bold text-lg shadow-lg`}
                >
                  {ft.ext}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 mt-4">
              Support for more file types may be added in future updates.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-16 sm:py-24 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Built for{' '}
              <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Everyone
              </span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              InsightRAG is used by professionals across various industries and roles.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {useCases.map((uc, i) => (
              <motion.div
                key={uc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/50 hover:border-purple-500/30 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <uc.icon className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{uc.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{uc.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Stop Searching Through{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Long Documents
              </span>{' '}
              Manually
            </h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              Upload your documents and let InsightRAG find the information for you.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5"
            >
              Start Using InsightRAG
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
