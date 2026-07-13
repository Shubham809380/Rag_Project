import { Link } from 'react-router-dom';
import { FileSearch } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-default)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center">
                <FileSearch className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-heading">InsightRAG</span>
            </Link>
            <p className="text-sm text-fg-secondary leading-relaxed max-w-xs">
              AI-powered document analysis platform. Upload documents, ask questions, and get instant intelligent answers.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-heading mb-4 text-sm">Product</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/login" className="text-sm text-fg-secondary hover:text-blue-400 transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-sm text-fg-secondary hover:text-blue-400 transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-heading mb-4 text-sm">Legal</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/privacy" className="text-sm text-fg-secondary hover:text-blue-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-fg-secondary hover:text-blue-400 transition-colors">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-heading mb-4 text-sm">Connect</h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-fg-secondary hover:text-blue-400 transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-fg-secondary hover:text-blue-400 transition-colors"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 text-center" style={{ borderTop: '1px solid var(--border-default)' }}>
          <p className="text-xs text-fg-muted">
            &copy; 2026 InsightRAG. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
