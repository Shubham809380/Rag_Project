import { Link } from 'react-router-dom';
import { FileSearch, PanelLeft, FolderOpen, Shield } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import { useAuth } from '../../context/AuthContext';

function Tip({ children, label }) {
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className="tooltip">{label}</span>
    </span>
  );
}

export default function DashboardHeader({ onToggleSidebar = () => {}, onToggleDocs = () => {}, docsPanelOpen = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email === 'patrashubhamm031@gmail.com';

  return (
    <header className="shrink-0 flex items-center justify-between px-4 h-14 z-30 glass"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2">
        <button onClick={onToggleSidebar} className="md:hidden p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-card-hover transition-colors focus-ring"
          title="Open sidebar">
          <PanelLeft size={17} />
        </button>
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #22D3EE)', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>
            <FileSearch className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-heading hidden sm:block">InsightRAG</span>
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        {isAdmin && (
          <Tip label="Admin Panel">
            <Link to="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all focus-ring"
              style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Shield size={15} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </Tip>
        )}
        <Tip label="Toggle documents panel">
          <button onClick={onToggleDocs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all focus-ring"
            style={{
              color: docsPanelOpen ? '#E2E8F0' : '#94A3B8',
              background: docsPanelOpen ? 'rgba(59,130,246,0.1)' : 'transparent',
              border: docsPanelOpen ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
            }}>
            <FolderOpen size={15} />
            <span className="hidden sm:inline">Documents</span>
          </button>
        </Tip>
        <Tip label="Toggle theme">
          <div><ThemeToggle /></div>
        </Tip>
      </div>
    </header>
  );
}
