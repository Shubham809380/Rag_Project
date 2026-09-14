import { useEffect, useState } from 'react';
import { lazy } from 'react';
import { Airplay, Shield, Wifi, WifiOff } from 'lucide-react';
import { getSovereignStatus } from '../../services/sovereign';
import ThreeScene, { use3DCapable } from '../3d/ThreeScene';

const SovereignAuroraScene = lazy(() => import('../3d/SovereignConstellationScene'));

const TECH_LABELS = [
  { top: '12%', left: '8%', tx: 'LOCAL NODE' },
  { top: '24%', left: '82%', tx: 'SECURE CHANNEL' },
  { top: '46%', left: '5%', tx: 'ISOLATED BOUNDARY' },
  { top: '58%', left: '88%', tx: 'MODEL ROUTER' },
  { top: '76%', left: '10%', tx: 'RAG INDEX' },
  { top: '88%', left: '78%', tx: 'TOOL SANDBOX' },
];

export default function SovereignAuthLayout({ children }) {
  const capable = use3DCapable();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getSovereignStatus().then(setStatus).catch(() => {});
  }, []);

  const models = status?.models || [];
  const availCount = models.filter(m => m.status === 'available').length;

  const Chip = ({ label, value, icon: Icon, ok }) => (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hud"
      style={{
        background: 'rgba(8,14,26,0.55)',
        borderColor: ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)',
        backdropFilter: 'blur(6px)',
      }}>
      <Icon size={14} style={{ color: ok ? '#34D399' : '#F87171' }} />
      <div className="text-left">
        <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-[13px] font-mono font-semibold" style={{ color: ok ? '#34D399' : '#F87171' }}>{value}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col-reverse lg:flex-row relative" style={{ background: 'transparent' }}>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ThreeScene Scene={SovereignAuroraScene} enabled={capable} mode="hero" />
      </div>

      {/* Left panel — the form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12 relative z-10 overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none bg-grid-fine opacity-50" />
        <div aria-hidden className="absolute -top-24 right-0 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.05), transparent 65%)' }} />

        {/* Mobile brand */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #38BDF8, #22D3EE)' }}>
            <Airplay size={16} className="text-slate-950" />
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Sovereign Workbench</span>
        </div>

        <div className="w-full max-w-md relative z-10 rise-1">
          {children}
        </div>
      </div>

      {/* Right panel — interactive 3D secure AI environment */}
      <div className="relative z-10 flex flex-col justify-between min-h-[60vh] lg:min-h-screen lg:w-[52%] p-12 order-first lg:order-last overflow-hidden"
        style={{ background: 'linear-gradient(200deg, rgba(7,11,20,0.62) 0%, rgba(10,15,28,0.55) 55%, rgba(7,25,33,0.6) 100%)' }}>

        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 55% at 50% 30%, rgba(34,211,238,0.05), transparent 60%), linear-gradient(180deg, rgba(7,11,20,0.3) 0%, transparent 45%, rgba(7,11,20,0.75) 100%)' }} />

        {/* Engineering telemetry markings */}
        <div aria-hidden className="absolute inset-0 pointer-events-none hidden md:block">
          {TECH_LABELS.map((l) => (
            <span key={l.tx} className="absolute font-mono text-[9px] tracking-[0.22em] uppercase"
              style={{ top: l.top, left: l.left, color: 'rgba(127,163,190,0.3)' }}>{l.tx}</span>
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #38BDF8, #22D3EE)', boxShadow: '0 4px 20px rgba(34,211,238,0.4)' }}>
              <Airplay size={20} className="text-slate-950" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-sky-400/80">MRPL · Smart Automation</div>
              <div className="text-[18px] font-bold text-white tracking-tight">Sovereign Workbench</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-9">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug mb-3">
              On-premise agentic AI.
              <br />
              <span className="gradient-text">Zero cloud dependencies.</span>
            </h2>
            <p className="text-[14px] text-slate-400 leading-relaxed max-w-md">
              Local models. Local RAG. Local OCR. Approved human-in-the-loop workflow —
              everything runs inside your plant network. No data ever leaves this machine.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-3">Live system status</div>
            <div className="grid grid-cols-1 max-w-sm gap-2">
              <Chip label="Mode" value={status?.mode || 'local'} icon={Shield} ok={status?.mode === 'local'} />
              <Chip label="Egress" value={status?.egress === 'deny' ? 'deny · blocked' : (status?.internetConnected ? 'online' : 'deny')} icon={status?.internetConnected ? Wifi : WifiOff} ok={status?.egress === 'deny'} />
              <Chip label="Local models" value={status?.models ? `${availCount} active` : 'loading…'} icon={Airplay} ok={availCount > 0} />
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-600">
            <span>Sovereign Mode: <span className="text-emerald-400">ON</span></span>
            <span className="w-px h-3" style={{ background: 'rgba(148,163,184,0.2)' }} />
            <span>No external auth</span>
            <span className="w-px h-3" style={{ background: 'rgba(148,163,184,0.2)' }} />
            <span>Audit-trail logged</span>
          </div>
        </div>
      </div>
    </div>
  );
}