import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  CircleCheck as CheckCircle,
  XSquare,
  Clock,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  LoaderCircle as Loader2,
} from 'lucide-react';
import { getSovereignTasks } from '../../services/sovereign';

const RISK_STYLE = {
  low:    { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  high:   { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

const STATUS_STYLE = {
  awaiting_approval: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Awaiting' },
  waiting_approval:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Pending' },
  completed:         { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Completed' },
  failed:            { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  label: 'Failed' },
  running:           { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Running' },
};

function RiskBadge({ level }) {
  const s = RISK_STYLE[level] || RISK_STYLE.low;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono"
      style={{ color: s.color, background: s.bg }}
    >
      <ShieldAlert size={11} />
      {level || 'low'}
    </span>
  );
}

function StatusBadge({ status, approvalStatus }) {
  const display = approvalStatus === 'pending' ? 'waiting_approval' : status;
  const s = STATUS_STYLE[display] || STATUS_STYLE[running];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      {display === 'completed' ? <CheckCircle size={11} /> : display === 'failed' ? <XSquare size={11} /> : <Clock size={11} />}
      {s.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-3"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}1f` }}
      >
        <Icon size={17} style={{ color }} />
      </div>
      <div>
        <div className="text-[20px] font-bold" style={{ color: 'var(--text-heading)' }}>{value}</div>
        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

export default function SovereignApprovals() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSovereignTasks();
      setTasks(data?.tasks || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const approvalTasks = useMemo(
    () => tasks.filter(
      (t) => t.status === 'waiting_approval' || t.status === 'awaiting_approval' || t.approvalStatus === 'pending'
    ),
    [tasks]
  );

  const pendingCount = useMemo(
    () => tasks.filter(
      (t) => (t.status === 'waiting_approval' || t.status === 'awaiting_approval' || t.approvalStatus === 'pending')
        && t.approvalStatus !== 'approved'
    ).length,
    [tasks]
  );

  const approvedToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter(
      (t) => t.approvalStatus === 'approved' && t.updatedAt && new Date(t.updatedAt) >= today
    ).length;
  }, [tasks]);

  const rejectedCount = useMemo(
    () => tasks.filter((t) => t.approvalStatus === 'rejected').length,
    [tasks]
  );

  if (loading && tasks.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading approval tasks…</span>
        </div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="text-[13px] rounded-xl border p-4" style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} style={{ color: '#F59E0B' }} />
            <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-heading)' }}>Approvals</h1>
          </div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Review and act on pending sovereign agent tasks requiring human approval.
          </p>
        </div>
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Pending Approval" value={pendingCount} color="#F59E0B" />
        <StatCard icon={CheckCircle} label="Approved Today" value={approvedToday} color="#10B981" />
        <StatCard icon={XSquare} label="Rejected" value={rejectedCount} color="#EF4444" />
      </div>

      {/* Table */}
      {approvalTasks.length === 0 ? (
        <div
          className="rounded-xl border p-12 flex flex-col items-center justify-center gap-3 text-center"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <CheckCircle size={36} style={{ color: '#10B981', opacity: 0.6 }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>
            All approvals are currently completed.
          </p>
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            No tasks are awaiting human review at this time.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Task</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Requested By</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Risk</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Created</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="px-4 py-3 font-semibold text-right" style={{ color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvalTasks.map((t) => (
                  <tr
                    key={t.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover, rgba(255,255,255,0.02))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="px-4 py-3">
                      <div className="max-w-[320px]">
                        <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {t.title || t.question?.slice(0, 80) || 'Untitled task'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                            style={{ color: 'var(--text-muted)', background: 'var(--bg-base)' }}
                          >
                            {t.taskType || 'agent'}
                          </span>
                          {t.model && (
                            <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {t.model}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {t.userEmail || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={t.approvalRisk} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} approvalStatus={t.approvalStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/workbench/approvals/${t.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                        style={{
                          color: '#3B82F6',
                          background: 'rgba(59,130,246,0.08)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.16)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                      >
                        View
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error toast at bottom */}
      {error && (
        <div
          className="text-[12px] rounded-lg border p-3"
          style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
