import { useState, useEffect } from 'react';
import { MessageSquare, Zap, FileSearch, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { Card, PageHeader, PageLoader, Badge } from '../components/common/ui';
import { getUserAnalytics } from '../services/api';
import { useLanguage } from '../i18n';

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { try { setData(await getUserAnalytics()); } finally { setLoading(false); } })();
  }, []);

  if (loading) return <AppLayout title={t('analytics')}><PageLoader /></AppLayout>;

  const totals = data?.totals || {};
  const stats = [
    { icon: MessageSquare, label: 'Questions', value: totals.questions || 0, color: '#3B82F6' },
    { icon: CheckCircle2, label: 'Successful', value: totals.successful || 0, color: '#22C55E' },
    { icon: XCircle, label: 'Failed', value: totals.failed || 0, color: '#EF4444' },
    { icon: Zap, label: 'Avg Response (s)', value: ((totals.avg_latency || 0) / 1000).toFixed(1), color: '#F59E0B' },
  ];

  return (
    <AppLayout title={t('analytics')}>
      <div className="max-w-5xl mx-auto p-6">
        <PageHeader title={t('analytics')} subtitle="Track how your knowledge base is being used" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}1a` }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-heading">{value}</p>
                <p className="text-[12px] text-fg-muted">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold text-heading mb-3 flex items-center gap-2"><TrendingUp size={16} style={{ color: '#3B82F6' }} /> Most Searched Topics</h3>
            {data?.searchStats?.length ? (
              <div className="space-y-2">
                {data.searchStats.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-fg-muted truncate mr-3">{s.query}</span>
                    <Badge color="#3B82F6">{s.count}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-fg-muted">No search data yet. Start chatting to see usage.</p>}
          </Card>

          <Card>
            <h3 className="font-semibold text-heading mb-3 flex items-center gap-2"><FileSearch size={16} style={{ color: '#8B5CF6' }} /> Recent Activity</h3>
            {data?.recentActivity?.length ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.recentActivity.map((a, i) => (
                  <div key={i} className="text-sm border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-fg truncate mr-2">{a.query || a.type}</span>
                      <Badge color={a.success === false ? '#EF4444' : '#22C55E'}>{a.success === false ? 'failed' : (a.latency_ms ? `${(a.latency_ms/1000).toFixed(1)}s` : 'ok')}</Badge>
                    </div>
                    <div className="text-[11px] text-fg-muted mt-0.5">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-fg-muted">No activity yet.</p>}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
