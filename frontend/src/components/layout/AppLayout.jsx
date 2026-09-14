import { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FileSearch, LayoutDashboard, FolderOpen, Database, Search, Bot,
  GitCompare, GraduationCap, BarChart3, Settings, User, Shield, LogOut,
  PanelLeftClose, PanelLeftOpen, Menu, Airplay, Terminal, Fingerprint, Files,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSovereignAuth } from '../../context/SovereignAuthContext';
import { useLanguage } from '../../i18n';
import ThemeToggle from '../ThemeToggle';

export default function AppLayout({ children, title }) {
  const { user, logout } = useAuth();
  const { user: sovUser, logout: sovLogout } = useSovereignAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.email === 'patrashubhamm031@gmail.com';
  const isSovereignRoute = location.pathname.startsWith('/workbench');

  const handleLogout = async () => {
    if (isSovereignRoute) {
      try { await sovLogout(); } catch {}
      navigate('/workbench/login', { replace: true });
    } else {
      await logout();
      navigate('/login');
    }
  };

  const baseLink = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-ring';
  const activeLink = 'text-white';
  const inactiveLink = 'text-fg-muted hover:bg-card-hover hover:text-fg';

  const items = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { to: '/documents', icon: FolderOpen, label: t('documents') },
    { to: '/knowledge-bases', icon: Database, label: t('knowledgeBases') },
    { to: '/research', icon: Search, label: t('research') },
    { to: '/assistant', icon: Bot, label: t('aiAssistant') },
    { to: '/compare', icon: GitCompare, label: t('compare') },
    { to: '/study', icon: GraduationCap, label: t('studyMode') },
    { to: '/analytics', icon: BarChart3, label: t('analytics') },
    { to: '/settings', icon: Settings, label: t('settings') },
  ];

  const sovereignItems = [
    { to: '/workbench', icon: Airplay, label: 'Sovereign' },
    { to: '/workbench/agent', icon: Terminal, label: 'Agent Workbench' },
    { to: '/workbench/documents', icon: Files, label: 'Docs' },
    { to: '/workbench/audit', icon: Fingerprint, label: 'Audit' },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 h-14">
        <Link to={isSovereignRoute ? '/workbench' : '/'} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: isSovereignRoute ? 'linear-gradient(135deg, #10B981, #22D3EE)' : 'linear-gradient(135deg, #3B82F6, #22D3EE)' }}>
            {isSovereignRoute
              ? <Airplay className="w-4 h-4 text-white" />
              : <FileSearch className="w-4 h-4 text-white" />}
          </div>
          {!collapsed && (
            isSovereignRoute
              ? <span className="text-[12px] font-bold uppercase tracking-widest text-heading">Sovereign</span>
              : <span className="text-[15px] font-bold text-heading">InsightRAG</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${baseLink} ${isActive ? activeLink : inactiveLink}`}
            style={({ isActive }) => isActive ? {
              background: 'linear-gradient(135deg, #3B82F6, #22D3EE)',
              boxShadow: '0 2px 8px rgba(59,130,246,0.25)',
            } : undefined}
            title={collapsed ? label : undefined}
          >
            <Icon size={17} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        <div className="pt-3 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-fg-muted">Sovereign</div>
          {sovereignItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `${baseLink} ${isActive ? activeLink : inactiveLink}`}
              style={({ isActive }) => isActive ? { background: 'linear-gradient(135deg,#1E3A8A,#22D3EE)' } : undefined}
              title={collapsed ? label : undefined}>
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="pt-3 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <NavLink to="/profile" className={({ isActive }) => `${baseLink} ${isActive ? activeLink : inactiveLink}`}
            style={({ isActive }) => isActive ? { background: 'linear-gradient(135deg, #3B82F6, #22D3EE)' } : undefined}
            title={collapsed ? t('profile') : undefined}>
            <User size={17} className="shrink-0" />
            {!collapsed && <span className="truncate">{t('profile')}</span>}
          </NavLink>
          {isAdmin && (
            <>
            <NavLink to="/admin" className={({ isActive }) => `${baseLink} ${isActive ? activeLink : inactiveLink}`}
              style={({ isActive }) => isActive ? { background: 'linear-gradient(135deg, #F59E0B, #F59E0B)' } : undefined}
              title={collapsed ? t('admin') : undefined}>
              <Shield size={17} className="shrink-0" />
              {!collapsed && <span className="truncate">{t('admin')}</span>}
            </NavLink>
            <NavLink to="/admin/eval" className={({ isActive }) => `${baseLink} ${isActive ? activeLink : inactiveLink}`}
              style={({ isActive }) => isActive ? { background: 'linear-gradient(135deg, #F59E0B, #F59E0B)' } : undefined}
              title={collapsed ? 'RAG Evaluation' : undefined}>
              <BarChart3 size={17} className="shrink-0" />
              {!collapsed && <span className="truncate">RAG Evaluation</span>}
            </NavLink>
            </>
          )}
        </div>
      </nav>

      <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 text-fg-muted">
              <ThemeToggle />
              <span className="text-[12px]">{t('theme')}</span>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className={`${baseLink} w-full text-fg-muted hover:bg-card-hover hover:text-error`}>
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>{t('logout')}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-sidebar transition-all duration-300 sidebar-transition border-r ${collapsed ? 'w-[64px]' : 'w-[240px]'}`}
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 bottom-0 w-[260px] bg-sidebar">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="shrink-0 flex items-center justify-between px-4 h-14 z-30 glass"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-lg text-fg-muted hover:bg-card-hover">
              <Menu size={17} />
            </button>
            <button onClick={() => setCollapsed((v) => !v)} className="hidden md:block p-2 rounded-lg text-fg-muted hover:bg-card-hover">
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
            <h1 className="text-[16px] font-semibold text-heading">{title || (isSovereignRoute ? 'Sovereign Workbench' : 'InsightRAG')}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link to="/profile"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
              {(isSovereignRoute ? sovUser : user)?.full_name?.[0]?.toUpperCase()
                || (isSovereignRoute ? sovUser : user)?.name?.[0]?.toUpperCase()
                || (isSovereignRoute ? sovUser : user)?.email?.[0]?.toUpperCase()
                || 'U'}
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
