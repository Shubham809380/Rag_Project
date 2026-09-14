import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings2,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  UserRound,
  KeyRound,
  Mail,
  Building2,
  IdCard,
} from 'lucide-react';
import { useSovereignAuth } from '../../context/SovereignAuthContext';
import { sovereignChangePassword } from '../../services/sovereignAuthService';

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

export default function SovereignSettings() {
  const { user, logout, checkAuth } = useSovereignAuth();
  const navigate = useNavigate();

  const mustChange = !!user?.mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await logout(); } catch { /* best-effort */ }
    navigate('/workbench/login', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (!newPassword || !confirmPassword) {
      setError('Fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match');
      return;
    }
    setSubmitting(true);
    try {
      await sovereignChangePassword(mustChange ? '' : currentPassword, newPassword);
      if (checkAuth) await checkAuth();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg =
        code === 'BAD_CURRENT'
          ? 'Current password is incorrect'
          : code === 'SAME_PASSWORD'
            ? 'New password must differ from current password'
            : code === 'POLICY'
              ? err?.response?.data?.message
              : err?.response?.data?.message || 'Unable to update password';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = user?.full_name || user?.name || user?.email || 'Sovereign User';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || (user?.email || 'U')[0].toUpperCase();

  const role = user?.role || user?.role_id || null;
  const inputClass =
    'w-full pl-10 pr-10 py-2.5 rounded-lg border text-[13px] focus:outline-none focus:ring-1'
    .trim();

  const fieldWrap = (key) => (
    <button
      type="button"
      onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      aria-label="Toggle password visibility"
    >
      {show[key] ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  const passwordInput = (key, value, setter, placeholder, autoComplete) => (
    <div className="relative">
      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
      <input
        type={show[key] ? 'text' : 'password'}
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
        autoComplete={autoComplete}
      />
      {fieldWrap(key)}
    </div>
  );

  return (
    <div className="p-6 max-w-[1000px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings2 size={18} style={{ color: '#38BDF8' }} />
        <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-heading)' }}>Settings</h1>
      </div>

      {/* Profile card */}
      <div className="tech-card p-5">
        <div className="text-[11px] uppercase tracking-wider font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <UserRound size={13} style={{ color: '#38BDF8' }} />
          Account Profile
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-bold text-slate-950 shrink-0"
            style={{ background: 'linear-gradient(135deg,#38BDF8,#22D3EE)', boxShadow: '0 4px 18px rgba(34,211,238,0.35)' }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold truncate" style={{ color: 'var(--text-heading)' }}>{displayName}</span>
              {role && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: ROLE_COLOR[role] || '#94A3B8', background: `${ROLE_COLOR[role] || '#94A3B8'}1f` }}
                >
                  {ROLE_LABEL[role] || role}
                </span>
              )}
              <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} title="Authenticated" />
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
              <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                {user?.email || '—'}
              </div>
              {user?.department && (
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Building2 size={12} style={{ color: 'var(--text-muted)' }} />
                  {user.department}
                </div>
              )}
              {user?.employeeId && (
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <IdCard size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="font-mono">EMP {user.employeeId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change password card */}
      <div className="tech-card p-5">
        <div className="text-[11px] uppercase tracking-wider font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <KeyRound size={13} style={{ color: '#F59E0B' }} />
          {mustChange ? 'Set Password' : 'Change Password'}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-[520px]">
          {mustChange && (
            <div
              className="rounded-lg border px-3 py-2 text-[12px] flex items-start gap-2"
              style={{ borderColor: 'rgba(245,158,11,0.35)', color: '#F59E0B', background: 'rgba(245,158,11,0.08)' }}
            >
              <KeyRound size={13} className="shrink-0 mt-0.5" />
              No password is set yet. Choose a strong one now — it is stored (hashed) in the on-premise database and becomes your sign-in password.
            </div>
          )}
          {!mustChange && (
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Current password</label>
              {passwordInput('current', currentPassword, setCurrentPassword, 'Enter current password', 'current-password')}
            </div>
          )}
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>New password</label>
            {passwordInput('next', newPassword, setNewPassword, '12+ chars, letters & numbers', 'new-password')}
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confirm new password</label>
            {passwordInput('confirm', confirmPassword, setConfirmPassword, 'Re-type new password', 'new-password')}
          </div>
          {error && (
            <div
              className="rounded-lg border px-3 py-2 text-[12px] flex items-center gap-2"
              style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}
            >
              <Lock size={13} />
              {error}
            </div>
          )}
          {saved && (
            <div
              className="rounded-lg border px-3 py-2 text-[12px] flex items-center gap-2"
              style={{ borderColor: 'rgba(16,185,129,0.35)', color: '#10B981', background: 'rgba(16,185,129,0.08)' }}
            >
              <ShieldCheck size={13} />
              {mustChange ? 'Password set successfully and saved to the on-premise database.' : 'Password updated successfully.'}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#10B981,#06B6D4)', color: '#fff' }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {submitting ? (mustChange ? 'Setting…' : 'Updating…') : (mustChange ? 'Set password' : 'Update password')}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-medium transition-colors border"
          style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.05)' }}
        >
          {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          {signingOut ? 'Signing out…' : 'Sign out of Sovereign'}
        </button>
      </div>
    </div>
  );
}