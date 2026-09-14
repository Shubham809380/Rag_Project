import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LoaderCircle as Loader2, UserPlus, ShieldCheck, CircleCheck as CheckCircle, AlertTriangle } from 'lucide-react';
import { DEPARTMENTS } from '../../constants/departments';
import SovereignAuthLayout from '../../components/auth/SovereignAuthLayout';
import { sovereignRegister } from '../../services/sovereignAuthService';
import { useSovereignAuth } from '../../context/SovereignAuthContext';

export default function SovereignSignupPage() {
  const nav = useNavigate();
  const { setUser } = useSovereignAuth();
  const [form, setForm] = useState({ fullName: '', email: '', employeeId: '', department: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setError('Full name, email and password are required.');
      return;
    }
    setBusy(true);
    try {
      const r = await sovereignRegister({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        employeeId: form.employeeId.trim(),
        department: form.department.trim(),
        password: form.password,
      });
      if (r.success === false) {
        setError(r.message || 'Registration failed');
      } else {
        setUser(r.user || null);
        nav('/workbench');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const input = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
  };

  const Label = ({ children }) => (
    <div className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{children}</div>
  );

  return (
    <SovereignAuthLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }}>
            <UserPlus size={16} className="text-white" />
          </span>
        </div>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-heading)' }}>Create a local account</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          Registered locally in the sovereign store. No email verification, no cloud.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Full name</Label>
          <input style={input} value={form.fullName} onChange={update('fullName')} placeholder="e.g. Rajesh Kumar" autoComplete="name" />
        </div>
        <div>
          <Label>Work email</Label>
          <input style={input} value={form.email} onChange={update('email')} placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Employee ID</Label>
            <input style={input} value={form.employeeId} onChange={update('employeeId')} placeholder="EMP-1234" />
          </div>
          <div>
            <Label>Department</Label>
            <select style={input} value={form.department} onChange={update('department')}>
              <option value="">Select department…</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label>Password</Label>
          <div className="relative">
            <input style={{ ...input, paddingRight: 38 }} type={showPw ? 'text' : 'password'} value={form.password}
              onChange={update('password')} placeholder="At least 12 characters" autoComplete="new-password" />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:opacity-70" aria-label="Toggle password">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <Label>Confirm password</Label>
          <div className="relative">
            <input style={{ ...input, paddingRight: 38 }} type={showPw ? 'text' : 'password'} value={form.confirm}
              onChange={update('confirm')} placeholder="Re-enter password" autoComplete="new-password" />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:opacity-70" aria-label="Toggle password">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12px]" style={{ background: 'rgba(239,68,68,.08)', color: '#EF4444' }}>
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : <>Create account</>}
        </button>

        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          <ShieldCheck size={14} style={{ color: '#10B981' }} />
          Account is stored locally (SQLite) with a hashed password. Roles are governed by the local RBAC policy.
        </div>
      </form>

      <div className="mt-6 pt-5 border-t text-center text-[13px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        Already have an account?{' '}
        <Link to="/workbench/login" className="font-semibold hover:underline" style={{ color: '#3B82F6' }}>Sign in</Link>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>
        <CheckCircle size={13} style={{ color: '#10B981' }} /> Offline onboarding · nothing leaves this machine
      </div>
    </SovereignAuthLayout>
  );
}