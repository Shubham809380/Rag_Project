import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, Fingerprint, MailCheck } from 'lucide-react';
import { useSovereignAuth } from '../context/SovereignAuthContext';
import { sovereignLogin } from '../services/sovereignAuthService';
import SovereignAuthLayout from '../components/auth/SovereignAuthLayout';

export default function SovereignLoginPage() {
  const { isAuthenticated, loading, checkAuth } = useSovereignAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(state.inactive ? 'Your account is inactive. Contact an administrator.' : '');
  const [banner, setBanner] = useState('');

  useEffect(() => {
    if (state.msg) setBanner(state.msg);
  }, [state.msg]);

  useEffect(() => {
    if (!loading && isAuthenticated) navigate('/workbench', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setBanner('');
    if (!email.trim() || !password) {
      setFormError('Enter your employee email and password');
      return;
    }
    setSubmitting(true);
    try {
      const res = await sovereignLogin(email.trim(), password);
      if (res?.user?.mustChangePassword) {
        await checkAuth();
        navigate('/workbench/change-password', { replace: true });
        return;
      }
      await checkAuth();
      navigate('/workbench', { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      setFormError(
        code === 'ACCOUNT_INACTIVE' ? 'Your account is inactive. Contact an administrator.'
        : code === 'LOCKED' ? 'Too many failed attempts. Try again later.'
        : 'Invalid credentials. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !isAuthenticated) return null;

  return (
    <SovereignAuthLayout>
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-heading mb-1">Sign in to workbench</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            On-premises account. No external authentication providers.
          </p>
        </div>

        {banner && <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA' }}>{banner}</div>}
        {formError && <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>{formError}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Work email</label>
            <div className="relative">
              <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2" size={17} style={{ color: 'var(--text-muted)' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@plant.local"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border text-[14px] outline-none transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={17} style={{ color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border text-[14px] outline-none transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full !py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Lock size={17} />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Access request info — honest on-prem design */}
        <div className="mt-8 rounded-xl p-4 text-[13px] leading-relaxed"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          <div className="flex items-start gap-2.5">
            <MailCheck size={16} className="mt-0.5 shrink-0" style={{ color: '#10B981' }} />
            <div>
              <div className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Need access?</div>
              <div>
                Self-signup is available locally.{' '}
                <Link to="/workbench/signup" className="font-semibold hover:underline" style={{ color: '#10B981' }}>
                  Create a workbench account
                </Link>{' '}
                or contact your system administrator with your employee ID to request access.
              </div>
            </div>
          </div>
        </div>
      </div>
    </SovereignAuthLayout>
  );
}
