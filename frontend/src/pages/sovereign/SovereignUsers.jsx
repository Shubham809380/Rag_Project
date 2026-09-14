import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Eye,
  EyeOff,
  LoaderCircle as Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {
  getSovereignUsers,
  createSovereignUser,
  updateSovereignUser,
} from '../../services/sovereign';
import { DEPARTMENTS } from '../../constants/departments';

const ROLES = ['admin', 'engineer', 'analyst', 'manager', 'inspector', 'reviewer'];

const ROLE_COLOR = {
  admin:     '#EF4444',
  engineer:  '#3B82F6',
  analyst:   '#10B981',
  manager:   '#F59E0B',
  inspector: '#6B7280',
  reviewer:  '#94A3B8',
};

const ROLE_DESC = {
  admin: 'Full platform control — manages users, roles, tool permissions, model routing and system configuration. Can approve any agent task.',
  engineer: 'Builds and runs sovereign agent tasks, writes sandboxed Python and manages document collections. Cannot modify roles or security policy.',
  analyst: 'Runs Q&A and analytics against the RAG corpus, reviews outputs and exports artifacts and reports for decision support.',
  manager: 'Monitors team activity and task throughput, reviews pending approval queues and steward summaries against plant deadlines.',
  inspector: 'Reviews output quality and safety, flags exceptions and signs off inspection checklists in the refinery workflow.',
  reviewer: 'Read-only oversight — inspects audit chains, task logs and approval history with no ability to mutate state.',
};

const inputCls = 'w-full rounded-lg border px-3 py-2 text-[12px] outline-none transition-colors focus:border-blue-500';

function RoleBadge({ role }) {
  const c = ROLE_COLOR[role] || '#6B7280';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono uppercase whitespace-nowrap"
      style={{ color: c, background: `${c}1a` }}
    >
      {role || '—'}
    </span>
  );
}

function StatusBadge({ status }) {
  const active = status === 'active';
  const c = active ? '#10B981' : '#EF4444';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ color: c, background: `${c}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString() : '—';
}

function fmtDateTime(v) {
  return v ? new Date(v).toLocaleString() : '—';
}

function NewUserModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', email: '', employeeId: '', department: '', role: 'analyst' });
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ fullName: '', email: '', employeeId: '', department: '', role: 'analyst' });
      setCreated(null);
      setError('');
      setSubmitting(false);
      setShowPassword(false);
    }
  }, [open]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await createSovereignUser({
        fullName: form.fullName,
        email: form.email,
        employeeId: form.employeeId,
        department: form.department,
        role: form.role,
      });
      setCreated(res);
      onCreated(res?.user);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,23,0.7)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--text-heading)' }}>New User</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              A temporary password is generated automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-base)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {created?.temporaryPassword ? (
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.06)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Lock size={14} style={{ color: '#10B981' }} />
              <span className="text-[12px] font-semibold" style={{ color: '#10B981' }}>User created</span>
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {created.user?.full_name || form.fullName || 'New user'} ·{' '}
              <span className="font-mono">{created.user?.email || form.email}</span>
            </div>
            <div
              className="mt-3 rounded-lg border p-3 flex items-center gap-2"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
            >
              <span className="font-mono text-[13px] font-bold tracking-wide" style={{ color: 'var(--text-heading)' }}>
                {showPassword ? created.temporaryPassword : '••••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="ml-auto p-1 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
              This password is shown once and must be changed on the user's first login.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
              style={{ color: '#fff', background: '#10B981' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#10B981'; }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Full Name
              </label>
              <input className={inputCls} style={inputStyle} value={form.fullName} onChange={set('fullName')}
                placeholder="e.g. Arun Nair" required />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Email
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="email" className={`${inputCls} pl-8`} style={inputStyle} value={form.email} onChange={set('email')}
                  placeholder="name@example.com" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Employee ID
                </label>
                <input className={`${inputCls} font-mono`} style={inputStyle} value={form.employeeId} onChange={set('employeeId')}
                  placeholder="EMP-0000" required />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Department
                </label>
                <select className={inputCls} style={inputStyle} value={form.department} onChange={set('department')}>
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Role
              </label>
              <select className={inputCls} style={inputStyle} value={form.role} onChange={set('role')}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="text-[11px] rounded-lg border p-2.5"
                style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg border text-[12px] font-medium disabled:opacity-50"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'transparent' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-50"
                style={{ color: '#fff', background: '#3B82F6' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#2563EB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#3B82F6'; }}
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                Create User
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function SovereignUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [apiError, setApiError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await getSovereignUsers();
      setUsers(d?.users || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setApiError('');
    try {
      const d = await getSovereignUsers();
      setUsers(d?.users || []);
    } catch (e) {
      setApiError(e?.response?.data?.error || e?.message || 'Failed to refresh users');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const changeStatus = async (u, status) => {
    setMenuOpen(null);
    if (u.status === status) return;
    setBusyId(u.id);
    setApiError('');
    try {
      await updateSovereignUser(u.id, { status });
      await fetchUsers();
    } catch (e) {
      setApiError(e?.response?.data?.error || e?.message || 'Failed to update user status');
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.employeeId || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q))
    : users;

  const inputStyle = { background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' };

  if (loading && users.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3 py-20 justify-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" />
          Loading user directory…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: '#3B82F6' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Users & Roles</h1>
          </div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage who can access the sovereign workbench and what each role can do.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, employee ID…"
              className="w-[240px] rounded-lg border pl-8 pr-3 py-1.5 text-[12px] outline-none"
              style={inputStyle}
            />
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
            style={{ color: '#fff', background: '#3B82F6' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#2563EB'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#3B82F6'; }}
          >
            <Plus size={13} />
            New User
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border p-4 text-center text-[13px]"
          style={{ background: 'var(--bg-card)', borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      {!error && (
        <>
          {/* Users table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <UserCog size={16} style={{ color: '#3B82F6' }} />
                <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
                  Directory
                </h3>
                <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {filtered.length} / {users.length} users
                </span>
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="px-5 pb-10 pt-4 flex flex-col items-center gap-2 text-center">
                <Users size={30} style={{ color: 'var(--text-muted)' }} />
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                  {users.length === 0 ? 'No users yet' : 'No matching users'}
                </p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {users.length === 0 ? 'Create the first workbench user to get started.' : 'Try a different search term.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left" style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Employee ID</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Department</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Last Login</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const open = menuOpen === u.id;
                      const active = u.status === 'active';
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-4 py-3">
                            <div className="font-semibold" style={{ color: 'var(--text-heading)' }}>{u.full_name || '—'}</div>
                            <div className="font-mono text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <Mail size={9} />
                              {u.email || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                              {u.employeeId || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                          <td className="px-4 py-3">
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{u.department || '—'}</span>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                              {fmtDateTime(u.lastLoginAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                              {fmtDate(u.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right relative">
                            {busyId === u.id ? (
                              <Loader2 size={15} className="animate-spin inline" style={{ color: '#3B82F6' }} />
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(open ? null : u.id); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                                style={{ color: 'var(--text-secondary)', background: 'var(--bg-base)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover, rgba(255,255,255,0.04))'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-base)'; }}
                              >
                                Status
                                <ChevronDown size={12} />
                              </button>
                            )}
                            {open && (
                              <div
                                className="absolute right-4 top-[calc(100%-4px)] mt-1 w-40 rounded-lg border p-1 z-20 shadow-lg"
                                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                              >
                                <button
                                  onClick={(e) => { e.stopPropagation(); changeStatus(u, 'active'); }}
                                  className="w-full text-left px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors"
                                  style={{ color: active ? '#10B981' : 'var(--text-secondary)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-base)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  {active && <span className="mr-1">✓</span>}Activate
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); changeStatus(u, 'inactive'); }}
                                  className="w-full text-left px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors"
                                  style={{ color: !active ? '#EF4444' : 'var(--text-secondary)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-base)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  {!active && <span className="mr-1">✓</span>}Deactivate
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RBAC overview */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UserCog size={16} style={{ color: '#F59E0B' }} />
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>Role-Based Access Control</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ROLES.map((role) => (
                <div key={role} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} style={{ color: ROLE_COLOR[role] }} />
                    <span className="text-[12px] font-semibold font-mono uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
                      {role}
                    </span>
                    <span className="ml-auto font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {users.filter((u) => u.role === role).length}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {ROLE_DESC[role]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {apiError && (
        <div className="text-[12px] rounded-lg border p-3"
          style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          {apiError}
        </div>
      )}

      <NewUserModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => fetchUsers()} />
    </div>
  );
}