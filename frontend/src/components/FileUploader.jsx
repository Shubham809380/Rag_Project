import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Upload, FileText, X, CheckCircle, GripVertical, Loader2 } from 'lucide-react';
import { formatFileSize } from '../utils/helpers';

function FileItem({ file, onRemove, index }) {
  return (
    <Reorder.Item
      value={file}
      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing"
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 25px rgba(0,0,0,0.15)', zIndex: 50 }}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {file.status === 'uploading' && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
        {file.status === 'ready' && (
          <CheckCircle className="w-4 h-4 text-success" />
        )}
        {file.status === 'error' && (
          <span className="text-xs text-error">Failed</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(file.id);
          }}
          className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>
    </Reorder.Item>
  );
}

export default function FileUploader({ files, onFilesAdd, onFileRemove, onReorder, disabled }) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      const newFiles = acceptedFiles.map((f) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        file: f,
        name: f.name,
        size: f.size,
        status: 'pending',
        fileId: null,
      }));
      onFilesAdd(newFiles);
    },
    [onFilesAdd]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 10,
    maxSize: 20 * 1024 * 1024,
    disabled,
  });

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Upload Documents ({files.length}/10)
      </label>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-primary/40 hover:bg-primary/5'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={isDragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
          className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3"
        >
          <Upload className="w-6 h-6 text-primary" />
        </motion.div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-xs text-slate-400">
          or click to browse — PDF, DOCX, TXT (max 10 files, 20MB each)
        </p>
      </div>

      {/* File List with Drag Reorder */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-2"
          >
            <Reorder.Group
              axis="y"
              values={files}
              onReorder={onReorder}
              className="space-y-2"
            >
              {files.map((file, index) => (
                <FileItem
                  key={file.id}
                  file={file}
                  index={index}
                  onRemove={onFileRemove}
                />
              ))}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
