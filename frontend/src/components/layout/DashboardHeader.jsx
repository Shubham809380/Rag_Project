import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, PanelLeft, FolderOpen, Shield, LayoutDashboard, Database, Search, Bot, GitCompare, GraduationCap, BarChart3, Settings, ChevronDown } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const features = [
    { to: '/documents', icon: FolderOpen, label: 'Documents' },
    { to: '/knowledge-bases', icon: Database, label: 'Knowledge Bases' },
    { to: '/research', icon: Search, label: 'Research' },
    { to: '/assistant', icon: Bot, label: 'AI Assistant' },
    { to: '/compare', icon: GitCompare, label: 'Compare' },
    { to: '/study', icon: GraduationCap, label: 'Study Mode' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

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
          <span className="text-[15px] font-bold text-heading hidden sm:block">Sovereign AI Workbench</span>
        </Link>
        <Link to="/dashboard" className={`ml-2 hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium ${!menuOpen ? 'text-blue-400' : 'text-fg-muted'} hover:bg-card-hover transition-colors`}>
          <LayoutDashboard size={15} />
          <span>Chat</span>
        </Link>
      </div>

      <div ref={menuRef} className="relative flex items-center gap-1.5">
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
        <Tip label="Features">
          <button onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all focus-ring"
            style={{ color: menuOpen ? '#E2E8F0' : '#94A3B8', background: menuOpen ? 'rgba(59,130,246,0.1)' : 'transparent', border: menuOpen ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent' }}>
            <LayoutDashboard size={15} />
            <span className="hidden sm:inline">Features</span>
            <ChevronDown size={13} className={menuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </Tip>
        <Tip label="Toggle theme">
          <div><ThemeToggle /></div>
        </Tip>

        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-xl border bg-card p-2 shadow-xl z-50"
            style={{ borderColor: 'var(--border-default)', boxShadow: 'var(--shadow-md)' }}>
            {features.map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-fg-secondary hover:bg-card-hover hover:text-fg transition-colors">
                <Icon size={15} style={{ color: '#3B82F6' }} /> {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
