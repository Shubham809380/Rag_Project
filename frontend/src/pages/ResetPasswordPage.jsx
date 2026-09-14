import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { resetPassword } from '../services/authService';
import AuthLayout from '../components/auth/AuthLayout';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) return setError('Missing reset token.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) { setError(err.message || 'Failed to reset password.'); }
    finally { setSubmitting(false); }
  };

  return (
    <AuthLayout>
      <div className="bg-card/80 border border-border rounded-3xl p-8 shadow-2xl backdrop-blur-xl max-w-md mx-auto">
        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <CheckCircle2 size={28} style={{ color: '#22C55E' }} />
            </div>
            <h1 className="text-2xl font-bold text-heading mb-2">Password updated</h1>
            <p className="text-sm text-fg-secondary">You can now sign in with your new password.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-heading mb-2">Set a new password</h1>
              <p className="text-sm text-fg-secondary">Choose a strong password for your account.</p>
            </div>

            {error && <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">{error}</div>}
            {!token && <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">This reset link is invalid or incomplete.</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-1.5">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-border text-fg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-1.5">Confirm password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password"
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-fg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <button type="submit" disabled={submitting || !token}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Update password'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="inline-flex items-center gap-2 text-xs text-fg-muted hover:text-fg-secondary"><ArrowLeft size={13} /> Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
