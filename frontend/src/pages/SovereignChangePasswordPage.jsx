import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { useSovereignAuth } from '../context/SovereignAuthContext';
import { sovereignChangePassword } from '../services/sovereignAuthService';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function SovereignChangePasswordPage() {
  const { user, loading, checkAuth, logout } = useSovereignAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <LoadingSpinner fullScreen />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match');
      return;
    }
    setSubmitting(true);
    try {
      await sovereignChangePassword(currentPassword, newPassword);
      await checkAuth();
      navigate('/workbench', { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg =
        code === 'BAD_CURRENT'
          ? 'Current password is incorrect'
          : code === 'SAME_PASSWORD'
            ? 'New password must differ from current password'
            : err?.response?.data?.message || 'Unable to update password';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full pl-10 pr-10 py-2.5 rounded-lg border border-card-border bg-bg-base text-fg-default placeholder:text-fg-muted/60 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20';
  const eyeBtn = (key) => (
    <button
      type="button"
      onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-default"
      aria-label="Toggle password visibility"
    >
      {show[key] ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--bg-base)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>
      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-heading">Update your password</span>
        </div>
        <p className="text-center text-fg-muted text-sm mb-8">
          {user?.mustChangePassword ? 'A one-time password was issued. Set a new password before continuing.' : `Signed in as ${user?.email}.`}
        </p>

        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-xl">
          {error && <div className="mb-4 rounded-lg bg-red-500/10 text-red-400 text-sm p-3">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">Current password</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
                <input
                  type={show.current ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="current-password"
                />
                {eyeBtn('current')}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">New password</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
                <input
                  type={show.next ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="12+ chars, upper/lower/number/symbol"
                  className={inputClass}
                  autoComplete="new-password"
                />
                {eyeBtn('next')}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">Confirm new password</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
                <input
                  type={show.confirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
                {eyeBtn('confirm')}
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck size={17} />}
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
          <button
            onClick={() => { logout(); navigate('/workbench/login', { replace: true }); }}
            className="mt-4 w-full text-center text-xs text-fg-muted hover:text-fg-default"
          >
            Cancel and sign out
          </button>
        </div>
      </div>
    </div>
  );
}