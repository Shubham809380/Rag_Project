import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Terminal,
  FileText,
  ChartColumn as BarChart3,
  Package,
  Eye,
  Code,
  CircleCheck as CheckCircle,
  ClipboardList,
  ShieldCheck,
  Lock,
  Cpu,
  Wrench,
  Users,
  Activity,
  FlaskConical,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  X,
  LoaderCircle as Loader2,
} from 'lucide-react';
import { useSovereignAuth } from '../../context/SovereignAuthContext';
import { getSovereignStatus, getSovereignDashboard, getSovereignDocuments } from '../../services/sovereign';

// ─── RBAC role sets ─────────────────────────────────────────────────────────
const ROLE_ALL = ['admin', 'engineer', 'analyst', 'manager', 'inspector', 'reviewer'];
const ROLE_STANDARD = ['admin', 'engineer', 'analyst', 'manager', 'inspector'];
const ROLE_MANAGER = ['admin', 'manager'];
const ROLE_ADMIN = ['admin'];

// ─── Navigation structure (grouped, RBAC filtered by role) ─────────────────
const navSections = [
  {
    label: 'Workspace',
    items: [
      { to: '/workbench', icon: 'LayoutDashboard', label: 'Dashboard', end: true, roles: ROLE_ALL },
      { to: '/workbench/agent', icon: 'Terminal', label: 'AI Workbench', roles: ROLE_STANDARD },
      { to: '/workbench/documents', icon: 'FileText', label: 'Documents', roles: ROLE_ALL },
      { to: '/workbench/data-analysis', icon: 'BarChart3', label: 'Data Analysis', roles: ROLE_STANDARD },
      { to: '/workbench/deliverables', icon: 'Package', label: 'Deliverables', roles: ROLE_ALL },
    ],
  },
  {
    label: 'AI Capabilities',
    items: [
      { to: '/workbench/vision', icon: 'Eye', label: 'Vision Analysis', roles: ROLE_STANDARD },
      { to: '/workbench/coding', icon: 'Code', label: 'Coding Assistant', roles: ROLE_STANDARD },
    ],
  },
  {
    label: 'Governance',
    items: [
      { to: '/workbench/approvals', icon: 'CheckCircle', label: 'Approvals', roles: ROLE_MANAGER },
      { to: '/workbench/audit', icon: 'ClipboardList', label: 'Audit Logs', roles: ROLE_MANAGER },
      { to: '/workbench/sovereignty', icon: 'ShieldCheck', label: 'Sovereignty Center', roles: ['admin', 'engineer', 'manager'] },
      { to: '/workbench/security', icon: 'Lock', label: 'Security Center', roles: ['admin', 'engineer'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/workbench/models', icon: 'Cpu', label: 'Model Manager', roles: ROLE_ADMIN },
      { to: '/workbench/tools', icon: 'Wrench', label: 'Tool Manager', roles: ROLE_ADMIN },
      { to: '/workbench/users', icon: 'Users', label: 'Users & Roles', roles: ROLE_ADMIN },
      { to: '/workbench/monitoring', icon: 'Activity', label: 'System Monitoring', roles: ROLE_ADMIN },
    ],
  },
];

const ICONS = {
  LayoutDashboard,
  Terminal,
  FileText,
  BarChart3,
  Package,
  Eye,
  Code,
  CheckCircle,
  ClipboardList,
  ShieldCheck,
  Lock,
  Cpu,
  Wrench,
  Users,
  Activity,
  FlaskConical,
};

const ROLE_LABEL = {
  admin: 'Admin',
  engineer: 'Engineer',
  analyst: 'Analyst',
  manager: 'Manager',
  inspector: 'Inspector',
  reviewer: 'Reviewer',
};

const ROLE_COLOR = {
  admin: '#F43F5E',
  manager: '#F59E0B',
  engineer: '#3B82F6',
  analyst: '#8B5CF6',
  inspector: '#06B6D4',
  reviewer: '#94A3B8',
};

const ROLE_LIST = Object.keys(ROLE_LABEL);

// ─── Small utilities ────────────────────────────────────────────────────────
function formatUptime(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'N/A';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m${s}s`;
  return `${m}m ${s}s`;
}

function formatTime(value) {
  if (!value) return '';
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return String(value);
  return t.toLocaleString();
}

function docNameOf(doc) {
  return doc?.name || doc?.filename || doc?.title || 'Untitled document';
}

export default function SovereignShell() {
  const { user, logout } = useSovereignAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [allDocs, setAllDocs] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const closeAll = useCallback(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setNotifOpen(false);
    setUserMenuOpen(false);
  }, []);

  // Fetch /sovereign/status + dashboard on mount, poll every 30s.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [sRes, dRes] = await Promise.allSettled([getSovereignStatus(), getSovereignDashboard()]);
      if (!alive) return;
      if (sRes.status === 'fulfilled') {
        setStatus(sRes.value);
        setStatusError('');
      } else {
        setStatusError(sRes.reason?.response?.data?.error || sRes.reason?.message || 'Unable to reach sovereign core');
      }
      if (dRes.status === 'fulfilled') setDashboard(dRes.value);
      setStatusLoading(false);
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Close overlays + mobile sidebar on navigation.
  const routeKey = location.pathname;
  useEffect(() => {
    closeAll();
  }, [routeKey, closeAll]);

  // Escape key closes any open overlay.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeAll]);

  // Auto focus search input when opened.
  useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [searchOpen]);

  // Fetch document catalog for the search overlay.
  useEffect(() => {
    if (!searchOpen) return;
    let alive = true;
    setSearchLoading(true);
    setSearchError('');
    getSovereignDocuments()
      .then((data) => {
        if (!alive) return;
        setAllDocs(Array.isArray(data) ? data : data?.documents || []);
      })
      .catch((e) => {
        if (!alive) return;
        setSearchError(e?.response?.data?.error || e?.message || 'Document search is temporarily unavailable');
        setAllDocs([]);
      })
      .finally(() => {
        if (alive) setSearchLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [searchOpen]);

  // Client-side name matching over the fetched catalog.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allDocs.filter((d) => {
      const hay = `${docNameOf(d)} ${d?.classification || ''} ${d?.collection || ''}`.toLowerCase();
      return hay.includes(q);
    });
    return (q ? list : allDocs).slice(0, 10);
  }, [allDocs, query]);

  // ─── Derived data ─────────────────────────────────────────────────────────
  const role = ROLE_LIST.includes(user?.role) ? user.role : 'reviewer';
  const sections = useMemo(
    () =>
      navSections
        .map((sec) => ({ ...sec, items: sec.items.filter((it) => it.roles.includes(role)) }))
        .filter((sec) => sec.items.length > 0),
    [role],
  );

  const models = status?.models || [];
  const availableModels = models.filter((m) => m.status === 'available').length;
  const egress = status?.egress || 'n/a';
  const internetConnected = status?.internetConnected === true;
  const uptimeSecs = status?.telemetry?.uptimeSeconds ?? status?.uptimeSeconds ?? status?.uptime;

  const { notifItems, pendingCount } = useMemo(() => {
    const pendingList = Array.isArray(dashboard?.pendingApprovals) ? dashboard.pendingApprovals : [];
    const auditEvents = Array.isArray(dashboard?.auditEntries) ? dashboard.auditEntries : [];
    const approvals = pendingList.slice(0, 4).map((p) => ({
      id: `a-${p?.id || Math.random()}`,
      kind: 'Approval',
      title: p?.title ? `Approval required — ${p.title}` : 'Approval required',
      to: '/workbench/approvals',
      time: p?.createdAt || p?.updatedAt,
      dot: '#F59E0B',
    }));
    const events = auditEvents.slice(0, 4).map((a) => ({
      id: `e-${a?.id || Math.random()}`,
      kind: a?.level || 'Security event',
      title: a?.action || a?.event || a?.message || 'Security event',
      to: '/workbench/audit',
      time: a?.createdAt || a?.timestamp,
      dot: ['critical', 'high'].includes(a?.level?.toLowerCase()) ? '#EF4444' : '#06B6D4',
    }));
    return { notifItems: [...approvals, ...events], pendingCount: pendingList.length };
  }, [dashboard]);

  const displayName = user?.full_name || user?.email || 'Sovereign User';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || (user?.email || 'U')[0].toUpperCase();

  const handleLogout = async () => {
    closeAll();
    await logout();
    navigate('/workbench/login', { replace: true });
  };

  const go = (to) => {
    closeAll();
    navigate(to);
  };

  const renderSidebar = ({ collapsed, onCollapse, showCollapse }) => (
    <div className="flex flex-col h-full relative" style={{ background: 'linear-gradient(180deg, var(--bg-sidebar) 0%, #070B14 100%)' }}>
      {/* top edge glow */}
      <div aria-hidden className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent)' }} />
      {/* Sidebar header / collapse toggle */}
      <div className="flex items-center justify-between h-14 px-3 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        {collapsed ? (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg,#38BDF8,#22D3EE)', boxShadow: '0 2px 12px rgba(34,211,238,0.4)' }}
          >
            <ShieldCheck size={16} className="text-slate-950" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 pl-1">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#38BDF8,#22D3EE)', boxShadow: '0 2px 10px rgba(34,211,238,0.35)' }}>
              <ShieldCheck size={13} className="text-slate-950" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Sovereign Core
            </span>
          </div>
        )}
        {showCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors focus-ring"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto overflow-x-hidden">
        {sections.map((sec) => (
          <div key={sec.label}>
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {sec.label}
              </div>
            )}
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = ICONS[item.icon];
                const isApprovals = item.to === '/workbench/approvals';
                return (
                  <Fragment key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `side-nav-link ${isActive ? 'active' : ''} ${collapsed ? '!justify-center !px-0' : ''}`
                      }
                    >
                      <span className="relative shrink-0">
                        <Icon size={17} />
                        {isApprovals && pendingCount > 0 && (
                          <span
                            className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center bg-amber-500 text-white text-[9px] font-bold font-mono"
                            style={{ boxShadow: '0 1px 4px rgba(245,158,11,0.5)' }}
                          >
                            {pendingCount > 99 ? '99+' : pendingCount}
                          </span>
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status bar */}
      <div className="shrink-0 border-t px-3 py-2.5 space-y-1.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
        {statusLoading ? (
          <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-[var(--text-muted)]">
            <Loader2 size={13} className="animate-spin" />
            <span className="font-mono">SYNCING TELEMETRY…</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-[11px]" title={statusError || 'Core status'}>
              <span className="text-[var(--text-muted)]">UPTIME</span>
              <span className="font-mono font-semibold" style={{ color: statusError ? '#EF4444' : 'var(--text-primary)' }}>
                {statusError ? 'OFFLINE' : formatUptime(uptimeSecs)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[var(--text-muted)]">MODELS</span>
              <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                {availableModels}/{models.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-[var(--text-muted)]">
                <Activity size={11} />
                GATEWAY
              </span>
              {statusError ? (
                <span className="font-mono font-semibold text-red-400">DEGRADED</span>
              ) : (
                <span
                  className="font-mono font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    color: internetConnected ? '#F59E0B' : '#10B981',
                    background: internetConnected ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                  }}
                >
                  {egress.toUpperCase()}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer: settings + sign out */}
      <div className="shrink-0 border-t flex items-center gap-1 px-2 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => go('/workbench/settings')}
          title={collapsed ? 'Settings' : undefined}
          className="flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium hover:bg-[var(--bg-card-hover)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Settings size={14} style={{ color: 'var(--text-muted)' }} />
          {!collapsed && <span>Settings</span>}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className="flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium hover:bg-[rgba(239,68,68,0.1)] transition-colors"
          style={{ color: '#EF4444' }}
        >
          <LogOut size={14} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  // ─── Search overlay ───────────────────────────────────────────────────────
  const searchOverlay = searchOpen ? (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
      <div
        className="relative w-full max-w-2xl rounded-2xl border shadow-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <Search size={17} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sovereign documents…"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[var(--text-muted)]"
            style={{ color: 'var(--text-primary)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults.length === 1) go('/workbench/documents');
            }}
          />
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded border text-[10px] font-mono" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors focus-ring"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[52vh] overflow-y-auto">
          {searchLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-[var(--text-muted)]">
              <Loader2 size={15} className="animate-spin" />
              Loading document index…
            </div>
          ) : searchError ? (
            <div className="py-8 px-4 text-center text-[12px]" style={{ color: '#EF4444' }}>
              {searchError}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-8 px-4 text-center text-[12px] text-[var(--text-muted)]">
              {query.trim() ? `No documents match “${query}”.` : 'No documents indexed yet.'}
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {searchResults.map((d) => (
                <li key={d?.id || d?.fileId || docNameOf(d)}>
                  <button
                    type="button"
                    onClick={() => go('/workbench/documents')}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        <FileText size={14} className="inline-block mr-1.5 -mt-0.5" style={{ color: 'var(--text-muted)' }} />
                        {docNameOf(d)}
                      </span>
                      {d?.classification && (
                        <span className="mt-0.5 inline-block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                          {d.classification}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {d?.id || d?.fileId || ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between px-4 h-10 text-[10px] text-[var(--text-muted)] border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <span className="font-mono uppercase tracking-wider">Local index · {allDocs.length} docs</span>
          <button type="button" onClick={() => go('/workbench/documents')} className="uppercase tracking-wider hover:text-[var(--text-primary)]">
            Open Documents →
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ─── Notification panel ───────────────────────────────────────────────────
  const notifPanel = notifOpen ? (
    <div className="absolute right-0 top-[calc(100%+8px)] w-[330px] max-w-[calc(100vw-2rem)] rounded-xl border shadow-lg overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
      <div className="flex items-center justify-between px-4 h-11 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>Notifications</span>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">{notifItems.length} items</span>
      </div>
      <ul className="max-h-[340px] overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {notifItems.length === 0 && (
          <li className="px-4 py-8 text-center text-[12px] text-[var(--text-muted)]">No pending notifications.</li>
        )}
        {notifItems.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => go(n.to)}
              className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: n.dot }} />
              <span className="min-w-0">
                <span className="block text-[12px] leading-snug truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</span>
                <span className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
                  <span>{n.kind}</span>
                  {n.time && <span>· {formatTime(n.time)}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between px-4 h-9 border-t text-[10px] font-mono uppercase tracking-wider" style={{ borderColor: 'var(--border-subtle)' }}>
        <button type="button" className="hover:text-[var(--text-primary)]" onClick={() => go('/workbench/approvals')}>Approvals</button>
        <button type="button" className="hover:text-[var(--text-primary)]" onClick={() => go('/workbench/audit')}>Audit log</button>
      </div>
    </div>
  ) : null;

  // ─── User menu ────────────────────────────────────────────────────────────
  const userMenu = userMenuOpen ? (
    <div className="absolute right-0 top-[calc(100%+8px)] w-[260px] rounded-xl border shadow-lg overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{displayName}</div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ color: ROLE_COLOR[role], background: `${ROLE_COLOR[role]}1f` }}
          >
            {ROLE_LABEL[role]}
          </span>
          {user?.employeeId && (
            <span className="text-[10px] font-mono text-[var(--text-muted)]">EMP {user.employeeId}</span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-[var(--text-secondary)] truncate">{user?.department || 'Unassigned department'}</div>
        <div className="mt-0.5 text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</div>
      </div>
    </div>
  ) : null;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sidebar-transition border-r ${sidebarCollapsed ? 'w-[64px]' : 'w-[248px]'}`}
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {renderSidebar({
          collapsed: sidebarCollapsed,
          onCollapse: () => setSidebarCollapsed((v) => !v),
          showCollapse: true,
        })}
      </aside>

      {/* Mobile sidebar (overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 bottom-0 w-[280px] max-w-[85vw] border-r" style={{ borderColor: 'var(--border-subtle)' }}>
            {renderSidebar({ collapsed: false, showCollapse: false })}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top header */}
        <header
          className="topbar shrink-0 flex items-center justify-between gap-3 px-3 md:px-4 h-16 z-30"
        >
          {/* Left: mobile menu + logo + badges */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] transition-colors focus-ring"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#38BDF8,#22D3EE)', boxShadow: '0 2px 12px rgba(34,211,238,0.35)' }}
              >
                <ShieldCheck size={18} className="text-slate-950" />
              </div>
              <div className="hidden sm:block min-w-0">
                <div className="text-[14px] font-bold truncate" style={{ color: 'var(--text-heading)' }}>
                  Sovereign AI Workbench
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Domain · On-Premise
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1.5 ml-1 shrink-0">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
                Sovereign Mode
              </span>
              {statusLoading ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider"
                  style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)' }}>
                  <Loader2 size={11} className="animate-spin" />
                  probing
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono"
                  style={
                    (egress || '').toLowerCase() === 'deny'
                      ? { background: 'rgba(16,185,129,0.12)', color: '#10B981' }
                      : { background: 'rgba(245,158,11,0.14)', color: '#F59E0B' }
                  }
                >
                  <ShieldCheck size={11} />
                  egress: {egress || 'n/a'}
                </span>
              )}
            </div>
          </div>

          {/* Right: search + notifications + user */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg border text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors focus-ring"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <Search size={14} />
              <span>Search documents…</span>
              <kbd className="px-1 py-0.5 rounded border text-[9px] font-mono" style={{ borderColor: 'var(--border-subtle)' }}>
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="md:hidden p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] transition-colors focus-ring"
              aria-label="Search documents"
            >
              <Search size={18} />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); setNotifOpen((v) => !v); }}
                className="relative p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors focus-ring"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {notifItems.length > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center bg-amber-500 text-white text-[9px] font-bold font-mono"
                    style={{ boxShadow: '0 1px 5px rgba(245,158,11,0.5)' }}
                  >
                    {notifItems.length > 99 ? '99+' : notifItems.length}
                  </span>
                )}
              </button>
              {notifPanel}
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setNotifOpen(false); setUserMenuOpen((v) => !v); }}
                className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors focus-ring"
                aria-label="Account menu"
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-slate-950 shrink-0"
                  style={{ background: 'linear-gradient(135deg,#38BDF8,#22D3EE)', boxShadow: '0 2px 10px rgba(34,211,238,0.4)' }}
                >
                  {initials}
                </span>
                <span className="hidden lg:block text-[12px] font-medium max-w-[140px] truncate" style={{ color: 'var(--text-primary)' }}>
                  {displayName}
                </span>
                <ChevronDown size={14} className="hidden lg:block" style={{ color: 'var(--text-muted)' }} />
              </button>
              {userMenu}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {searchOverlay}
    </div>
  );
}