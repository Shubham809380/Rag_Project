import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Trash2, X, Search, PanelLeftClose, PanelLeftOpen, LogOut, Settings, MoreHorizontal, Pen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { updateConversation } from '../../services/api';
import toast from 'react-hot-toast';

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const secs = Math.floor((now - date) / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function groupByDate(items) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const groups = {};
  for (const item of items) {
    const d = new Date(item.updated_at || item.created_at);
    let label = 'Older';
    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= weekAgo) label = 'Previous 7 days';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

const SECTIONS = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];

export default function ChatSidebar({ conversations, activeId, onSelect, onNewChat, onDelete, collapsed, onToggleCollapse, isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const sorted = [...conversations].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((c) => c.title?.toLowerCase().includes(q));
  }, [conversations, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const initials = (user?.full_name || 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const startRename = (conv) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title || '');
    setMenuId(null);
  };

  const saveRename = async (id) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try { await updateConversation(id, renameValue.trim()); setRenamingId(null); toast.success('Renamed'); } 
    catch { toast.error('Rename failed'); setRenamingId(null); }
  };

  const w = collapsed ? 68 : 260;

  const sidebarInner = (
    <div className="h-full flex flex-col" style={{ width: w, minWidth: w, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-subtle)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 shrink-0" style={{ minHeight: 56 }}>
        {!collapsed && <span className="text-[13px] font-semibold text-slate-300">Conversations</span>}
        <div className="flex items-center gap-0.5">
          <button onClick={onToggleCollapse} className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors focus-ring" title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button onClick={onClose} className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-2.5 shrink-0">
        <button onClick={onNewChat} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-all focus-ring"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.35)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.25)'; }}
          title="New Chat"
        >
          <Plus size={16} />
          {!collapsed && 'New Chat'}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pb-2.5 shrink-0">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
            <Search size={13} className="text-slate-500 shrink-0" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..." className="bg-transparent text-[13px] text-slate-200 placeholder-slate-600 focus:outline-none w-full" />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
              Ctrl+K
            </kbd>
          </div>
        </div>
      )}

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {filtered.length === 0 && (
          <div className={`flex flex-col items-center justify-center gap-2 ${collapsed ? 'px-1 py-8' : 'px-4 py-10'} text-center`}>
            <MessageSquare size={collapsed ? 18 : 24} style={{ color: 'var(--text-muted)' }} />
            {!collapsed && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{search ? 'No results' : 'No conversations yet'}</p>}
          </div>
        )}

        {!collapsed ? (
          SECTIONS.map((section) => {
            const items = grouped[section];
            if (!items || items.length === 0) return null;
            return (
              <div key={section} className="mb-2.5">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{section}</p>
                {items.map((conv) => {
                  const isActive = conv.id === activeId;
                  const isRenaming = renamingId === conv.id;
                  const menuOpen = menuId === conv.id;
                  return (
                    <div key={conv.id}
                      onClick={() => !isRenaming && onSelect(conv.id)}
                      className="group relative flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-all"
                      style={{
                        background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                        borderLeft: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; if (!menuOpen) setMenuId(null); }}
                    >
                      <MessageSquare size={13} className="shrink-0" style={{ color: isActive ? '#3B82F6' : '#475569' }} />
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => saveRename(conv.id)} onKeyDown={(e) => { if (e.key === 'Enter') saveRename(conv.id); if (e.key === 'Escape') setRenamingId(null); }}
                            onClick={(e) => e.stopPropagation()} autoFocus
                            className="w-full bg-transparent text-[13px] text-white focus:outline-none rounded px-1"
                            style={{ border: '1px solid rgba(59,130,246,0.4)' }}
                          />
                        ) : (
                          <p className="text-[13px] truncate" style={{ color: isActive ? '#E2E8F0' : '#94A3B8' }}>{conv.title}</p>
                        )}
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{timeAgo(conv.updated_at || conv.created_at)}</p>
                      </div>
                      <div className="relative shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setMenuId(menuOpen ? null : conv.id); }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: '#64748B' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#E2E8F0'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        <AnimatePresence>
                          {menuOpen && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-7 w-36 rounded-xl py-1 z-50"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}
                            >
                              <button onClick={(e) => { e.stopPropagation(); startRename(conv); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors"
                                style={{ color: '#CBD5E1' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Pen size={12} /> Rename
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); onDelete(conv.id); setMenuId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors"
                                style={{ color: '#EF4444' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          filtered.map((conv) => (
            <div key={conv.id} onClick={() => onSelect(conv.id)} className="flex items-center justify-center rounded-lg p-2.5 cursor-pointer transition-colors mb-0.5"
              style={{ background: conv.id === activeId ? 'rgba(59,130,246,0.1)' : 'transparent' }} title={conv.title}>
              <MessageSquare size={14} style={{ color: conv.id === activeId ? '#3B82F6' : '#475569' }} />
            </div>
          ))
        )}
      </div>

      {/* Profile */}
      <div className="shrink-0 px-3 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" style={{ border: '1.5px solid var(--border-default)' }} />
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>{initials}</div>
          )}
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-slate-300 truncate">{user?.full_name || 'User'}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => navigate('/profile')} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors" title="Settings">
                  <Settings size={13} />
                </button>
                <button onClick={handleLogout} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors" title="Sign out">
                  <LogOut size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:block h-full sidebar-transition shrink-0">{sidebarInner}</div>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
            <motion.div key="drawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.22 }} className="fixed inset-y-0 left-0 z-50 md:hidden">{sidebarInner}</motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
