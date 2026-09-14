import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { forgotPassword } from '../services/authService';
import AuthLayout from '../components/auth/AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email'); return; }
    setSubmitting(true);
    try {
      const res = await forgotPassword(email.trim());
      if (res.success === false && res.message) setError(res.message);
      else setSent(true);
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setSubmitting(false); }
  };

  return (
    <AuthLayout>
      <div className="bg-card/80 border border-border rounded-3xl p-8 shadow-2xl backdrop-blur-xl max-w-md mx-auto">
        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <CheckCircle2 size={28} style={{ color: '#22C55E' }} />
            </div>
            <h1 className="text-2xl font-bold text-heading mb-2">Check your email</h1>
            <p className="text-sm text-fg-secondary mb-6">If an account exists for <b>{email}</b>, we've sent a password reset link. It expires in 15 minutes.</p>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium"><ArrowLeft size={15} /> Back to sign in</Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-heading mb-2">Forgot password?</h1>
              <p className="text-sm text-fg-secondary">Enter your email and we'll send you a reset link.</p>
            </div>

            {error && <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-border text-fg placeholder-fg-muted text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 'Send reset link'}
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
