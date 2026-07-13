import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users, FileText, MessageSquare, BarChart3, Eye, Calendar, ArrowLeft, RefreshCw, Search, ChevronDown, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAdminStats, getAdminUsers, getAdminVisits, getAdminVisitStats } from '../services/api';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [visitStats, setVisitStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isAdmin = user?.role === 'admin' || user?.email === 'patrashubhamm031@gmail.com';

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      const [s, u, v, vs] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminVisits(200),
        getAdminVisitStats(),
      ]);
      setStats(s);
      setUsers(u);
      setVisits(v);
      setVisitStats(vs);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
    setLoading(false);
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center p-8 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <Shield size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>Access Denied</h1>
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>You don't have admin privileges.</p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#3B82F6' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredVisits = visits.filter(v =>
    v.email?.toLowerCase().includes(search.toLowerCase()) ||
    v.page?.toLowerCase().includes(search.toLowerCase()) ||
    v.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'visits', label: 'Visits', icon: Eye },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <header className="sticky top-0 z-30 glass border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="w-px h-5" style={{ background: 'var(--border-default)' }} />
            <div className="flex items-center gap-2">
              <Shield size={18} style={{ color: '#3B82F6' }} />
              <h1 className="text-[15px] font-bold" style={{ color: 'var(--text-heading)' }}>Admin Panel</h1>
            </div>
          </div>
          <button onClick={loadData} className="p-2 rounded-lg transition-colors hover:bg-card-hover" style={{ color: 'var(--text-muted)' }} title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
              style={{
                background: tab === t.id ? '#3B82F6' : 'transparent',
                color: tab === t.id ? '#fff' : 'var(--text-secondary)',
              }}>
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="#3B82F6" />
              <StatCard icon={FileText} label="Documents" value={stats.totalDocuments} color="#8B5CF6" />
              <StatCard icon={MessageSquare} label="Questions Asked" value={stats.totalQuestions} color="#22D3EE" />
              <StatCard icon={Globe} label="Total Visits" value={stats.totalVisits} color="#22C55E" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatCard icon={Eye} label="Today's Visits" value={stats.todayVisits} color="#F59E0B" />
              <StatCard icon={Users} label="Unique Visitors" value={stats.uniqueVisitors} color="#EC4899" />
              <StatCard icon={MessageSquare} label="Conversations" value={stats.totalConversations} color="#8B5CF6" />
            </div>

            {visitStats.length > 0 && (
              <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Visits (Last 30 Days)</h3>
                <div className="flex items-end gap-1 h-40">
                  {visitStats.map((s, i) => {
                    const max = Math.max(...visitStats.map(x => x.visits));
                    const h = max > 0 ? (s.visits / max) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.visits}</span>
                        <div className="w-full rounded-t" style={{ height: `${h}%`, background: 'linear-gradient(180deg, #3B82F6, #22D3EE)', minHeight: 2 }} />
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {new Date(s.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search users by name or email..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm border outline-none transition-colors"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>
              <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {filteredUsers.length} users
              </span>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>User</th>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Role</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Provider</th>
                      <th className="text-center px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Docs</th>
                      <th className="text-center px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Chats</th>
                      <th className="text-center px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Questions</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Joined</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="transition-colors hover:bg-card-hover" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                              style={{ background: u.role === 'admin' ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                              {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate" style={{ color: 'var(--text-heading)' }}>{u.full_name}</p>
                              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={{
                              background: u.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.1)',
                              color: u.role === 'admin' ? '#F59E0B' : '#3B82F6',
                            }}>
                            {u.role === 'admin' ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {u.auth_provider === 'google' ? 'Google' : 'Email'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          <span style={{ color: 'var(--text-secondary)' }}>{u.doc_count}</span>
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          <span style={{ color: 'var(--text-secondary)' }}>{u.conv_count}</span>
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          <span style={{ color: 'var(--text-secondary)' }}>{u.question_count}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  No users found
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'visits' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search visits by email, page, or name..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm border outline-none transition-colors"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>
              <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {filteredVisits.length} visits
              </span>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>User</th>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Page</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>IP</th>
                      <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>User Agent</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map(v => (
                      <tr key={v.id} className="transition-colors hover:bg-card-hover" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium" style={{ color: 'var(--text-heading)' }}>{v.full_name || 'Guest'}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.email || '—'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                            <Globe size={11} /> {v.page}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{v.ip_address?.substring(0, 15) || '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell max-w-[200px] truncate">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{v.user_agent?.substring(0, 50) || '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {v.created_at ? new Date(v.created_at).toLocaleString() : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredVisits.length === 0 && (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  No visits recorded yet
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 50 }}>
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-default)', borderTopColor: '#3B82F6' }} />
          </div>
        )}
      </div>
    </div>
  );
}
