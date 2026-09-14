import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Settings, Save, Loader2, Mic } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { Card, PageHeader, PageLoader, PrimaryButton, Select, Badge } from '../components/common/ui';
import { getSettings, updateSettings, getVoiceCapabilities } from '../services/api';
import { useLanguage, LANGUAGES } from '../i18n';

export default function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voice, setVoice] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, v] = await Promise.all([getSettings(), getVoiceCapabilities()]);
        setSettings(s.settings || {});
        setVoice(v.capabilities || {});
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <AppLayout title={t('settings')}><PageLoader /></AppLayout>;

  const set = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({ ...settings, language: lang });
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  return (
    <AppLayout title={t('settings')}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' } }} />
      <div className="max-w-3xl mx-auto p-6">
        <PageHeader title={t('settings')} subtitle="Configure how Sovereign AI Workbench answers for you"
          actions={<PrimaryButton onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t('save')}</PrimaryButton>} />

        <div className="space-y-5">
          <Card>
            <h3 className="font-semibold text-heading mb-4 flex items-center gap-2"><Settings size={16} style={{ color: '#3B82F6' }} /> {t('language')} & Model</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">{t('language')}</label>
                <Select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full">
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.native})</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">{t('model')}</label>
                <Select value={settings.model} onChange={(e) => set('model', e.target.value)} className="w-full">
                  {['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'].map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-heading mb-4">Response & Search</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">{t('responseLength')}</label>
                <Select value={settings.response_length} onChange={(e) => set('response_length', e.target.value)} className="w-full">
                  {['short', 'balanced', 'detailed'].map((r) => <option key={r} value={r}>{t(r)}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">{t('ragMode')}</label>
                <Select value={settings.rag_mode} onChange={(e) => set('rag_mode', e.target.value)} className="w-full">
                  {['hybrid', 'vector', 'keyword'].map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">{t('retrievalDepth')}</label>
                <Select value={settings.retrieval_depth} onChange={(e) => set('retrieval_depth', Number(e.target.value))} className="w-full">
                  {[3, 5, 8, 10, 12, 15].map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">{t('temperature')}</label>
                <input type="range" min={0} max={1} step={0.1} value={settings.temperature ?? 0.2}
                  onChange={(e) => set('temperature', Number(e.target.value))} className="w-full mt-3" />
                <div className="text-[12px] text-fg-muted text-right">{settings.temperature}</div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-heading mb-4 flex items-center gap-2"><Mic size={16} style={{ color: '#F59E0B' }} /> Voice & Agent</h3>
            <div className="space-y-3">
              <Toggle label="Agentic Mode" desc="Let the AI plan and use tools (search, calculator, web)" checked={settings.agent_mode} onChange={(v) => set('agent_mode', v)} />
              <Toggle label="Web Research" desc="Include web search results when answering" checked={settings.web_research} onChange={(v) => set('web_research', v)} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg">Voice (speech-to-text)</span>
                <Badge color={voice?.stt?.available ? '#22C55E' : '#94A3B8'}>{voice?.stt?.available ? 'Available' : 'Browser only'}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg">Text-to-speech</span>
                <Badge color={voice?.browserTTS ? '#22C55E' : '#94A3B8'}>{voice?.browserTTS ? 'Available (browser)' : 'Off'}</Badge>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <PrimaryButton onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t('save')}</PrimaryButton>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-fg">{label}</p>
        {desc && <p className="text-[12px] text-fg-muted">{desc}</p>}
      </div>
      <button onClick={() => onChange(!checked)}
        className="relative w-12 h-6 rounded-full transition-colors focus-ring"
        style={{ background: checked ? 'linear-gradient(135deg,#3B82F6,#22D3EE)' : 'var(--bg-input)', border: '1px solid var(--border-default)' }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: checked ? 'calc(100% - 22px)' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}
