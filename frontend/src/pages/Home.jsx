import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { History as HistoryIcon } from 'lucide-react';

import Hero from '../components/Hero';
import QuestionInput from '../components/QuestionInput';
import FileUploader from '../components/FileUploader';
import AnalyzeButton from '../components/AnalyzeButton';
import LoadingState from '../components/LoadingState';
import ResultCard from '../components/ResultCard';
import HistorySidebar from '../components/HistorySidebar';
import PromptTemplates from '../components/PromptTemplates';
import { uploadDocument, analyzeDocument, getHistory } from '../services/api';
import { promptTemplates } from '../utils/templates';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getHistory();
      setHistory(Array.isArray(data) ? data : data.history || []);
    } catch {
      setHistory([]);
    }
  };

  // Add new files and auto-upload each
  const handleFilesAdd = async (newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);

    for (const f of newFiles) {
      setFiles((prev) =>
        prev.map((item) => (item.id === f.id ? { ...item, status: 'uploading' } : item))
      );

      try {
        const data = await uploadDocument(f.file);
        const uploadedFileId = data.files?.[0]?.fileId || data.fileId;
        setFiles((prev) =>
          prev.map((item) =>
            item.id === f.id ? { ...item, status: 'ready', fileId: uploadedFileId } : item
          )
        );
        toast.success(`${f.name} uploaded!`);
      } catch {
        setFiles((prev) =>
          prev.map((item) => (item.id === f.id ? { ...item, status: 'error' } : item))
        );
        toast.error(`Failed: ${f.name}`);
      }
    }
  };

  const handleFileRemove = (fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleReorder = (newOrder) => {
    setFiles(newOrder);
  };

  const getFinalQuestion = () => {
    const template = promptTemplates.find((t) => t.id === selectedTemplate);
    if (template && template.prefix) {
      return `${template.prefix}\n\n${question.trim()}`;
    }
    return question.trim();
  };

  const hasUploadedFiles = files.some((f) => f.status === 'ready');

  const handleAnalyze = async () => {
    if (!question.trim() && selectedTemplate === 'custom') {
      toast.error('Please enter a question');
      return;
    }
    if (!hasUploadedFiles) {
      toast.error('Please upload at least one document');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const finalQuestion = getFinalQuestion();
      const firstFileId = files.find((f) => f.status === 'ready')?.fileId;
      const data = await analyzeDocument({
        question: finalQuestion,
        fileId: firstFileId,
        fileName: files.map((f) => f.name).join(', '),
      });
      setResult({
        answer: data.answer || data.result || data.response,
        question: question.trim() || promptTemplates.find((t) => t.id === selectedTemplate)?.label,
        fileName: files.map((f) => f.name).join(', '),
      });
      toast.success('Analysis complete!');
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (item) => {
    setResult({
      answer: item.answer || item.result,
      question: item.question,
      fileName: item.fileName,
    });
    setQuestion(item.question);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-screen bg-bg dark:bg-slate-950">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'dark:bg-slate-800 dark:text-white',
          duration: 3000,
        }}
      />

      <Hero />

      {/* Main Content */}
      <div id="analyzer" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
              onKeyDown={handleKeyDown}
            >
              {/* History toggle (mobile) */}
              <div className="flex justify-end mb-4 lg:hidden">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-300"
                >
                  <HistoryIcon className="w-4 h-4" />
                  History
                </button>
              </div>

              <div className="space-y-5">
                {/* Multi-file uploader with drag reorder */}
                <FileUploader
                  files={files}
                  onFilesAdd={handleFilesAdd}
                  onFileRemove={handleFileRemove}
                  onReorder={handleReorder}
                  disabled={loading}
                />

                {/* Prompt Templates */}
                <PromptTemplates
                  selected={selectedTemplate}
                  onSelect={setSelectedTemplate}
                />

                <QuestionInput
                  value={question}
                  onChange={setQuestion}
                  disabled={loading}
                  placeholder={
                    selectedTemplate !== 'custom'
                      ? 'Optional: Add specific details...'
                      : 'Ask anything about your uploaded documents...'
                  }
                />

                <div className="text-xs text-slate-400 text-center">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[10px]">Ctrl+Enter</kbd> to analyze
                </div>

                <AnalyzeButton
                  onClick={handleAnalyze}
                  loading={loading}
                  disabled={
                    selectedTemplate === 'custom'
                      ? !question.trim() || !hasUploadedFiles
                      : !hasUploadedFiles
                  }
                />
              </div>
            </motion.div>

            {/* Loading / Result */}
            <div className="mt-6">
              <AnimatePresence mode="wait">
                {loading && <LoadingState key="loading" />}
                {result && !loading && (
                  <ResultCard
                    key="result"
                    answer={result.answer}
                    question={result.question}
                    onRegenerate={handleAnalyze}
                  />
                )}
              </AnimatePresence>

              {/* Empty state */}
              {!loading && !result && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-center py-16"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <HistoryIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-400">Upload documents and ask a question to get started</p>
                </motion.div>
              )}
            </div>
          </div>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <HistorySidebar
          history={history}
          onSelect={handleHistorySelect}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </div>
  );
}
