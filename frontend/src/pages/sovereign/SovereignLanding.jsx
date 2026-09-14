import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, CloudOff, Activity, Cpu, Lock, Fingerprint, FileCheck, Workflow,
  ScanLine, Database, ArrowRight, CheckCircle, Wifi, Landmark, Network,
  Settings2, Sparkles, FileSearch, Building2, Target, Orbit, Menu, X,
} from 'lucide-react';
import { getSovereignStatus } from '../../services/sovereign';
import ThreeScene, { use3DCapable } from '../../components/3d/ThreeScene';
import useSceneGate from '../../components/3d/useSceneGate';
import SectionHeader from '../../components/ui/SectionHeader';
import GlowButton from '../../components/ui/GlowButton';
import StatusPill from '../../components/ui/StatusPill';

const SovereignConstellationScene = lazy(() => import('../../components/3d/SovereignConstellationScene'));
const AgentFlowScene = lazy(() => import('../../components/3d/AgentFlowScene'));
const ModelRouterScene = lazy(() => import('../../components/3d/ModelRouterScene'));
const KnowledgeSphereScene = lazy(() => import('../../components/3d/KnowledgeSphereScene'));

// The hero 3D morphs through the product story as the user scrolls.
const PHASE_SECTIONS = [
  { refKey: 'pipeline', phase: 1, nav: 'Pipeline' },
  { refKey: 'automation', phase: 2, nav: 'Automation' },
  { refKey: 'capabilities', phase: 3, nav: 'Capabilities' },
  { refKey: 'sovereignty', phase: 4, nav: 'Sovereignty' },
];

const ROUTER_TASKS = [
  { label: 'Analyze scanned inspection report', tag: 'VISION + TEXT', target: 1 },
  { label: 'Review Python / plant code', tag: 'CODING MODEL', target: 3 },
  { label: 'Embed maintenance SOPs', tag: 'EMBEDDING', target: 2 },
  { label: 'Summarize technical manual', tag: 'TEXT MODEL', target: 0 },
];

const KNOWLEDGE_FLOW = ['DOCS', 'OCR', 'CHUNK', 'EMBED', 'SQLITE VECTORS', 'RETRIEVE', 'LOCAL LLM'];

const FEATURES = [
  {
    icon: CloudOff, title: 'Zero Cloud Dependency',
    desc: 'Models, retrieval, analysis and data live inside the plant network. Outbound egress is actively blocked at the process boundary.',
    tone: '#10B981',
  },
  {
    icon: Cpu, title: 'Local-First AI Stack',
    desc: 'Reasoning, coding, vision and embeddings run on the on-premise gateway — Ollama models served locally on the same machine.',
    tone: '#38BDF8',
  },
  {
    icon: Fingerprint, title: 'Tamper-Evident Audit',
    desc: 'Every model call, tool execution and access attempt is hashed into a chained, verifiable audit log. Nothing can be altered silently.',
    tone: '#A78BFA',
  },
  {
    icon: Workflow, title: 'Agentic Workbench',
    desc: 'Multi-step, tool-calling agents plan, search the knowledge base, run deterministic code and produce Word, Excel and PDF deliverables.',
    tone: '#14B8A6',
  },
  {
    icon: Lock, title: 'Human-in-the-Loop Approvals',
    desc: 'High-risk outputs require an authorized reviewer to approve before release. Risk-tiered governance on every task.',
    tone: '#F59E0B',
  },
  {
    icon: ScanLine, title: 'Industrial Vision & OCR',
    desc: 'Inspection images, P&IDs and scanned documents are read by a local multimodal model and local OCR — no cloud upload, ever.',
    tone: '#34D399',
  },
];

const PIPELINE = [
  { step: '01', label: 'Ingest', desc: 'PDF, Excel, images and drawings are parsed locally and chunked.', icon: FileSearch },
  { step: '02', label: 'Embed', desc: 'Vectors built by the local embedding model, stored in sovereign SQLite.', icon: Database },
  { step: '03', label: 'Retrieve', desc: 'RAG pulls relevant context exclusively from the plant knowledge base.', icon: Network },
  { step: '04', label: 'Generate', desc: 'The local gateway model answers — fully on premises.', icon: Sparkles },
  { step: '05', label: 'Govern', desc: 'Audit hashed to the chain; high risk requires an approving reviewer.', icon: Lock },
  { step: '06', label: 'Deliver', desc: 'Word, Excel, PPT and PDF artifacts produced locally.', icon: FileCheck },
];

// Exact project data — nothing invented, nothing reworded.
const PROJECT_INFO = [
  { icon: Building2, label: 'Organization', value: 'Mangalore Refinery and Petrochemicals Limited (MRPL)' },
  { icon: Network, label: 'Department', value: 'Mangalore Refinery and Petrochemicals Limited (MRPL)' },
  { icon: Target, label: 'Category', value: 'Software' },
  { icon: Settings2, label: 'Theme', value: 'Smart Automation' },
  { icon: Orbit, label: 'Youtube Link', value: '—', note: 'Value not yet published' },
  { icon: Database, label: 'Dataset Link', value: 'Open-source models and publicly available document samples (sample scanned PDFs, sample P&IDs from open datasets) to be used for demonstration; no proprietary data required.' },
];

const AUTOMATION_STAGES = [
  { label: 'Input', desc: 'Documents, drawings, photos and prompts entered on premises.' },
  { label: 'Processing', desc: 'Local OCR, embeddings, retrieval and reasoning on the gateway.' },
  { label: 'Automation', desc: 'Agentic tool calls and sandboxed code execution orchestrated locally.' },
  { label: 'Output', desc: 'Governed deliverables produced and stored inside the plant.' },
];

const EXPLORE_MODULES = [
  { id: 'kb', title: 'Knowledge Base', desc: 'Scanned SOPs, manuals and inspection reports parsed and embedded entirely on the plant machine.', tone: '#38BDF8' },
  { id: 'agent', title: 'Agentic Workbench', desc: 'Multi-step agents call local tools, search the KB and iterate until a task is done.', tone: '#22D3EE' },
  { id: 'vision', title: 'Vision & OCR', desc: 'P&IDs, drawings and photos inspected by a local multimodal model — no cloud upload.', tone: '#34D399' },
  { id: 'code', title: 'Sandboxed Code', desc: 'Generated code executes deterministically in an isolated Docker sandbox.', tone: '#A78BFA' },
];

export default function SovereignLanding() {
  const capable = use3DCapable();
  const [status, setStatus] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [explore, setExplore] = useState('kb');
  const [phase, setPhase] = useState(0);
  const [activeNav, setActiveNav] = useState('Capabilities');
  const [routerTarget, setRouterTarget] = useState(null);
  const heroRef = useRef(null);
  const automationSection = useRef(null);
  const routingRef = useRef(null);
  const knowledgeRef = useRef(null);
  const automationOn = useSceneGate(automationSection);
  const routingOn = useSceneGate(routingRef);
  const knowledgeOn = useSceneGate(knowledgeRef);

  // Scroll-driven narrative for the fixed background core.
  useEffect(() => {
    const els = { hero: heroRef.current };
    PHASE_SECTIONS.forEach((s) => {
      const el = document.getElementById(s.refKey);
      if (el) els[s.refKey] = el;
    });
    const cfg = [
      { el: els.hero, phase: 0, nav: null },
      ...PHASE_SECTIONS.map((s) => ({ el: els[s.refKey], phase: s.phase, nav: s.nav })),
    ].filter((c) => c.el);
    if (!cfg.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const c = cfg.find((x) => x.el === e.target);
          if (c) {
            setPhase(c.phase);
            if (c.nav) setActiveNav(c.nav);
            else setActiveNav('Hero');
          }
        });
      },
      { rootMargin: '-38% 0px -58% 0px' },
    );
    cfg.forEach((c) => io.observe(c.el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSovereignStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const isOnline = status?.internetConnected === true;

  const counters = useMemo(() => {
    const t = status?.telemetry || {};
    const n = (status?.models || []).filter((m) => m.status === 'available').length;
    return [
      { label: 'External API Calls', value: t.externalApiCalls ?? '0', tone: '#34D399' },
      { label: 'Blocked Egress', value: t.blockedEgress ?? '0', tone: '#FBBF24' },
      { label: 'Local Models Online', value: n, tone: '#38BDF8' },
      { label: 'Local RAG Queries', value: t.localRagQueries ?? '0', tone: '#A78BFA' },
    ];
  }, [status]);

  const nav = [
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'Pipeline', href: '#pipeline' },
    { label: 'Automation', href: '#automation' },
    { label: 'Sovereignty', href: '#sovereignty' },
  ];

  return (
    <div className="min-h-screen w-full bg-[#05070C] text-slate-200" style={{ fontFeatureSettings: "'cv02','cv03','cv04','cv11'" }}>
      {/* Full-page 3D background — fixed, stays from top to the very bottom
          of the landing page while content scrolls over it. z-0 (not negative):
          a negative z-index would let the page's solid background paint over
          the canvas and hide the 3D. All content sections are relative and
          come later in DOM order, so they stack above it. */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ThreeScene Scene={SovereignConstellationScene} sceneProps={{ phase }} enabled={capable} mode="hero" />
      </div>

      {/* ─────────────────────────────── NAV ─────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 border-b transition-colors" style={{ background: 'rgba(5,7,12,0.78)', borderColor: 'rgba(148,163,184,0.1)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg,#38BDF8,#22D3EE)', boxShadow: '0 4px 18px rgba(34,211,238,0.35)' }}>
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="text-[15px] font-bold leading-none tracking-wide text-white">
                MRPL <span className="gradient-text">SOVEREIGN</span>
              </div>
              <div className="text-[10px] tracking-[0.22em] font-mono text-slate-500">AI WORKBENCH · SIH 26117</div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-[13px] text-slate-400">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="relative transition-colors hover:text-sky-300"
                style={activeNav === n.label ? { color: '#7DD3FC' } : undefined}>
                {n.label}
                {activeNav === n.label && (
                  <span className="absolute -bottom-1.5 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,#38BDF8,#22D3EE)' }} />
                )}
              </a>
            ))}
            <Link to="/workbench/login" className="hover:text-sky-300 transition-colors">Sign In</Link>
            <GlowButton to="/workbench/signup" small>Create Account</GlowButton>
          </nav>

          <button type="button" className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-white/5 focus:outline-none focus-visible:ring-2 ring-sky-400" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle menu">
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {navOpen && (
          <div className="lg:hidden border-t px-5 py-4 space-y-1" style={{ borderColor: 'rgba(148,163,184,0.1)', background: 'rgba(5,7,12,0.96)' }}>
            {nav.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setNavOpen(false)} className="block py-2 text-[13px] text-slate-300 hover:text-sky-300">{n.label}</a>
            ))}
            <div className="pt-2 flex gap-3">
              <GlowButton to="/workbench/login" variant="ghost" small className="flex-1">Sign In</GlowButton>
              <GlowButton to="/workbench/signup" small className="flex-1">Create Account</GlowButton>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────── HERO ─────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen overflow-hidden">
        <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 50% 30%, rgba(34,211,238,0.06), transparent 60%), linear-gradient(180deg, rgba(5,7,12,0.35) 0%, rgba(5,7,12,0) 40%, #05070C 92%)' }} />
        <div aria-hidden className="absolute inset-y-0 left-0 w-[58%]" style={{ background: 'linear-gradient(90deg, rgba(5,7,12,0.72), rgba(5,7,12,0.25) 55%, transparent)' }} />

        <div className="relative max-w-7xl mx-auto px-5 pt-36 pb-16 lg:pt-44 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-7">
              <StatusPill tone="#34D399">{status ? 'Sovereign Mode Active' : 'Sovereign Mode'}</StatusPill>
              <StatusPill tone={'#FBBF24'} mono>egress guard: {status?.egressMode || 'deny'}</StatusPill>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider text-slate-400 border" style={{ borderColor: 'rgba(148,163,184,0.15)' }}>
                <Wifi size={11} className={isOnline ? 'text-sky-400' : 'text-slate-500'} />
                host network: {isOnline ? 'reachable (guard still blocks app egress)' : 'offline'}
              </span>
            </div>

            <h1 className="text-[40px] leading-[1.06] font-extrabold tracking-tight text-white md:text-[62px]">
              Smart Automation,
              <br />
              <span className="gradient-text">engineered to stay sovereign.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-slate-400">
              <span className="text-slate-200 font-medium">Mangalore Refinery and Petrochemicals Limited (MRPL)</span> —
              a self-hosted, network-isolated AI workbench on open-weight multimodal models for confidential industrial work.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <GlowButton to="/workbench">Enter Workbench <ArrowRight size={15} /></GlowButton>
              <GlowButton to="/workbench/login" variant="ghost">Sign In</GlowButton>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-widest text-slate-500">
              <span className="inline-flex items-center gap-2"><Landmark size={13} className="text-sky-400" /> MRPL</span>
              <span className="inline-flex items-center gap-2"><Settings2 size={13} className="text-cyan-400" /> Theme · Smart Automation</span>
              <span className="inline-flex items-center gap-2"><Target size={13} className="text-emerald-400" /> Category · Software</span>
            </div>
          </div>

          {/* Live runtime telemetry — real counters from the sovereign monitor */}
          <div className="grid grid-cols-2 gap-3">
            {counters.map((c, i) => (
              <div key={c.label} className="glass-panel hud rounded-xl p-4 rise" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
                <div className="mt-1.5 text-[26px] font-bold font-mono leading-none" style={{ color: c.tone }}>{c.value}</div>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-slate-600">
                  <Activity size={11} /> live · process boundary
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-slate-600">
          <span>Scroll to explore</span>
          <span className="w-px h-8" style={{ background: 'linear-gradient(180deg,#38BDF8,transparent)' }} />
        </div>
      </section>

      {/* ───────────────────── PROJECT INFORMATION ───────────────────── */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-5">
          <SectionHeader
            eyebrow="Project Brief"
            title="One workbench. One plant. Zero cloud."
            subtitle="An on-premise agentic AI workbench with open-weight multimodal models for confidential industrial knowledge work."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROJECT_INFO.map((p) => (
              <div key={p.label} className="tech-card p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)' }}>
                    <p.icon size={17} style={{ color: '#38BDF8' }} />
                  </span>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{p.label}</div>
                </div>
                <div className="text-[13.5px] leading-relaxed text-slate-200">{p.value}</div>
                {p.note && <div className="mt-2 text-[11px] font-mono text-slate-500">{p.note}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── PIPELINE ─────────────────────────── */}
      <section id="pipeline" className="relative py-24" style={{ background: 'linear-gradient(180deg, #070B14 0%, #05070C 100%)' }}>
        <div className="max-w-7xl mx-auto px-5">
          <SectionHeader
            eyebrow="One Sovereign Pipeline"
            title="From plant document to governed deliverable"
            subtitle="Nothing leaves the machine at any stage of the flow."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PIPELINE.map((p) => (
              <div key={p.step} className="tech-card p-5 relative overflow-hidden">
                <div className="absolute -right-3 -top-4 font-mono text-[64px] font-bold leading-none text-[#0e1a2e] select-none">0{p.step[1]}</div>
                <div className="relative flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.22)' }}>
                    <p.icon size={15} style={{ color: '#22D3EE' }} />
                  </span>
                  <span className="font-mono text-[11px] tracking-widest text-sky-400">{p.step}</span>
                </div>
                <div className="mt-3 font-semibold text-[15px] text-white relative">{p.label}</div>
                <div className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400 relative">{p.desc}</div>
              </div>
            ))}
          </div>
          <div ref={knowledgeRef} className="relative mt-10">
            {knowledgeOn && (
              <div
                className="relative h-[260px] md:h-[320px] rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(148,163,184,0.1)' }}
              >
                <ThreeScene Scene={KnowledgeSphereScene} enabled={capable} mode="compact" />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              {KNOWLEDGE_FLOW.map((k, i) => (
                <span key={k} className="flex items-center gap-2">
                  <span className="mono-chip" style={{ color: ['#7DD3FC', '#38BDF8', '#38BDF8', '#38BDF8', '#34D399', '#2DD4BF', '#22D3EE'][i] }}>
                    {k}
                  </span>
                  {i < KNOWLEDGE_FLOW.length - 1 && <span className="text-slate-700">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── SMART AUTOMATION VISUALIZATION ────────────────── */}
      <section id="automation" ref={automationSection} className="relative py-24 overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(55% 50% at 50% 55%, rgba(34,211,238,0.05), transparent 65%)' }} />
        <div className="relative max-w-7xl mx-auto px-5">
          <SectionHeader
            eyebrow="Smart Automation Flow"
            title="A local automation network"
            subtitle="Input, processing, automation and output — each stage executed inside the plant boundary."
          />
          {/* 3D agentic workflow — contained right below the heading.
              A governed packet travels the full chain, every step visible. */}
          {automationOn && (
            <div className="relative mt-9 h-[360px] md:h-[440px] rounded-2xl overflow-hidden"
              style={{ borderColor: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.1)' }}>
              <ThreeScene Scene={AgentFlowScene} enabled={capable} mode="compact" />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {AUTOMATION_STAGES.map((s, i) => (
              <div key={s.label} className="glass-panel rounded-xl p-4 text-center">
                <div className="font-mono text-[11px] tracking-widest" style={{ color: ['#22D3EE', '#38BDF8', '#2DD4BF', '#34D399'][i] }}>
                  STAGE {i + 1} — {String.fromCharCode(65 + i)}
                </div>
                <div className="mt-1.5 font-bold text-white">{s.label}</div>
                <div className="mt-1 text-[12px] text-slate-400 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center text-[11px] font-mono text-slate-500">
            ◀ INPUT · PROCESSING · AUTOMATION · OUTPUT ▶
          </div>
        </div>
      </section>

      {/* ─────────────────────── MODEL ROUTING ─────────────────────── */}
      <section id="routing" ref={routingRef} className="relative py-24 overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(50% 50% at 50% 45%, rgba(34,211,238,0.05), transparent 65%)' }} />
        <div className="relative max-w-7xl mx-auto px-5">
          <SectionHeader
            eyebrow="Intelligent Model Routing"
            title="The right local model, chosen on-premise"
            subtitle="Every task is classified and routed only to the models inside the plant — a major differentiator of this workbench."
          />
          {routingOn && (
            <div
              className="relative h-[320px] md:h-[380px] rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(148,163,184,0.1)' }}
            >
              <ThreeScene Scene={ModelRouterScene} sceneProps={{ target: routerTarget }} enabled={capable} mode="compact" />
            </div>
          )}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ROUTER_TASKS.map((t) => {
              const active = routerTarget === t.target;
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setRouterTarget(t.target)}
                  className="tech-card p-3.5 text-left focus:outline-none focus-visible:ring-2 ring-sky-400"
                  style={active ? { borderColor: 'rgba(34,211,238,0.5)', boxShadow: '0 0 30px rgba(34,211,238,0.15)' } : undefined}
                >
                  <div className="text-[12px] leading-snug text-slate-200">{t.label}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: active ? '#22D3EE' : '#5B6B82' }}>
                      {t.tag}
                    </span>
                    <span className="w-2 h-2 rounded-full" style={{ background: active ? '#22D3EE' : '#223049', boxShadow: active ? '0 0 10px #22D3EE' : 'none' }} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRouterTarget(null)}
              className="text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors"
              style={{ color: routerTarget === null ? '#38BDF8' : '#5B6B82', border: '1px solid rgba(148,163,184,0.15)' }}
            >
              ⟲ auto demo mode
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── CAPABILITIES ─────────────────────────── */}
      <section id="capabilities" className="relative py-24" style={{ background: 'linear-gradient(180deg, #05070C 0%, #070B14 100%)' }}>
        <div className="max-w-7xl mx-auto px-5">
          <SectionHeader
            eyebrow="Capabilities"
            title="Engineered for critical infrastructure"
            subtitle="Every capability is built on the same principle: run it here, protect it here."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="tech-card p-5">
                <span className="inline-flex w-10 h-10 rounded-lg items-center justify-center mb-3.5" style={{ background: `${f.tone}1a`, border: `1px solid ${f.tone}30` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.tone }} />
                </span>
                <div className="font-semibold mb-1.5 text-white">{f.title}</div>
                <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── INTERACTIVE 3D EXPLORE ──────────────────── */}
      <section className="relative py-24 overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-grid-fine opacity-60" />
          <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] md:w-[720px] md:h-[720px] float-slow">
            <div className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(56,189,248,0.14)' }} />
            <div className="absolute inset-[16%] rounded-full" style={{ border: '1px dashed rgba(34,211,238,0.18)', animation: 'spin-slow 50s linear infinite' }} />
            <div className="absolute inset-[32%] rounded-full" style={{ border: '1px solid rgba(45,212,191,0.14)', animation: 'spin-slow-rev 34s linear infinite' }} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(56,189,248,0.08))', border: '1px solid rgba(34,211,238,0.35)', boxShadow: '0 0 80px rgba(34,211,238,0.3)' }} />
            <div className="absolute left-1/2 -top-2 -translate-x-1/2 w-3 h-3 rounded-full anchor-glow" style={{ background: 'rgba(56,189,248,0.7)' }} />
            <div className="absolute right-[8%] top-1/4 w-2.5 h-2.5 rounded-full anchor-glow" style={{ background: 'rgba(45,212,191,0.6)', animationDelay: '0.3s' }} />
            <div className="absolute left-[7%] bottom-1/4 w-2 h-2 rounded-full anchor-glow" style={{ background: 'rgba(34,211,238,0.6)', animationDelay: '0.7s' }} />
            <div className="absolute right-[18%] bottom-[14%] w-2.5 h-2.5 rounded-full anchor-glow" style={{ background: 'rgba(56,189,248,0.6)', animationDelay: '0.5s' }} />
          </div>
        </div>
        <div className="relative max-w-7xl mx-auto px-5">
          <SectionHeader
            eyebrow="Explore the System"
            title="The sovereign core powering the plant"
            subtitle="Knowledge, agents, vision and sandboxed code all orbit one local gateway — nothing is ever uploaded."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXPLORE_MODULES.map((m) => (
              <div
                key={m.id}
                onMouseEnter={() => setExplore(m.id)}
                onClick={() => setExplore(m.id)}
                className={`cursor-pointer rounded-xl p-4 transition-all duration-300 ${explore === m.id ? '' : 'opacity-55 hover:opacity-85'}`}
                style={explore === m.id
                  ? { backgroundColor: `${m.tone}14`, border: `1px solid ${m.tone}55`, boxShadow: `0 0 40px ${m.tone}18` }
                  : { border: '1px solid rgba(148,163,184,0.12)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white text-[14px]">{m.title}</div>
                  <span className="w-2 h-2 rounded-full" style={{ background: m.tone, boxShadow: `0 0 12px ${m.tone}` }} />
                </div>
                <div className="mt-2 text-[12px] leading-relaxed text-slate-400">{m.desc}</div>
                <div className="mt-3 h-px" style={{ background: `linear-gradient(90deg, ${m.tone}66, transparent)` }} />
                <div className="mt-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: m.tone }}>{explore === m.id ? '● Node active' : '○ hover to inspect'}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── SOVEREIGNTY ─────────────────────────── */}
      <section id="sovereignty" className="relative py-24">
        <div className="max-w-7xl mx-auto px-5">
          <div className="glass-panel rounded-2xl p-8 md:p-12 relative overflow-hidden">
            <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 70% at 85% 20%, rgba(167,139,250,0.1), transparent 55%)' }} />
            <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-[13px] font-semibold mb-4" style={{ color: '#34D399' }}>
                  <ShieldCheck className="w-5 h-5" /> THE SOVEREIGN PROMISE
                </div>
                <h2 className="text-2xl md:text-[32px] font-bold leading-tight text-white">
                  Your data is not a lawsuit waiting to happen.
                </h2>
                <ul className="mt-6 space-y-3 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                  <li className="flex items-start gap-2.5"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#34D399' }} /> No cloud OCR, no cloud embeddings, no sent-to-SaaS documents.</li>
                  <li className="flex items-start gap-2.5"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#34D399' }} /> Outbound egress blocked by an active guard — attempted leaks are logged, not executed.</li>
                  <li className="flex items-start gap-2.5"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#34D399' }} /> Every AI decision recorded on a tamper-evident, chained audit log.</li>
                  <li className="flex items-start gap-2.5"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#34D399' }} /> Runs entirely offline — models, database and tools on the local machine.</li>
                </ul>
              </div>
              <div className="glass-panel rounded-xl p-6 min-w-[260px] w-full lg:w-auto">
                <div className="text-[11px] uppercase tracking-wider mb-4 text-slate-500">Data Residency</div>
                <div className="space-y-2.5 text-[13px] font-mono">
                  {[['Models', 'LOCAL'], ['Database', 'LOCAL SQL'], ['Documents', 'ON-PREM'], ['Telemetry', 'LOCAL ONLY'], ['Egress', 'BLOCKED']].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-6">
                      <span className="text-slate-500">{k}</span>
                      <span className={v === 'BLOCKED' ? 'text-amber-400' : 'text-emerald-400'}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t text-[12px] flex items-center gap-1.5 text-slate-500" style={{ borderColor: 'rgba(148,163,184,0.1)' }}>
                  <Database className="w-3.5 h-3.5" /> SQLite local store · Node + Vite · Ollama gateway
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── CTA ─────────────────────────────── */}
      <section className="relative pb-24 px-5">
        <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-10 text-center relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 pointer-events-none bg-grid opacity-40" />
          <h2 className="relative text-2xl md:text-[30px] font-bold text-white">Ready to keep it sovereign?</h2>
          <p className="relative mt-2 text-[14px] text-slate-400">Local authentication, no cloud sign-in. Create your local plant account in seconds.</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <GlowButton to="/workbench/signup">Create Account <ArrowRight size={15} /></GlowButton>
            <GlowButton to="/workbench/login" variant="ghost">Sign In</GlowButton>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── FOOTER ─────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: 'rgba(148,163,184,0.1)' }}>
        <div className="max-w-7xl mx-auto px-5 py-9 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#38BDF8,#22D3EE)' }}>
              <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
            </span>
            MRPL Sovereign AI Workbench · Smart India Hackathon 2026
          </div>
          <div className="text-[12px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <CloudOff className="w-3.5 h-3.5 text-emerald-400" /> app-layer egress guard · <FileCheck className="w-3.5 h-3.5 ml-2 text-emerald-400" /> fully audited
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}