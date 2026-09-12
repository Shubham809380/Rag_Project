import { Component, lazy, Suspense, useMemo, useState } from 'react';

// Detects whether we can rely on motion-engineered visuals on this device.
// Reduced-motion users get the static industrial visual; everyone else gets
// the WebGL scene (which falls back gracefully if the GPU refuses a context).
export function use3DCapable() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }, []);
}

// Static, lightweight visual used whenever WebGL is unavailable or disabled.
export function IndustrialFallback({ mode = 'hero' }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(60% 55% at 50% 42%, rgba(56,189,248,0.16), transparent 60%),' +
          'radial-gradient(40% 40% at 20% 80%, rgba(34,211,238,0.12), transparent 60%),' +
          'radial-gradient(40% 40% at 80% 20%, rgba(45,212,191,0.1), transparent 60%)',
      }} />
      {mode === 'hero' ? (
        <>
          <div className="absolute inset-0 bg-grid-fine opacity-80" />
          <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-[340px] h-[340px] md:w-[460px] md:h-[460px] float-slow">
              <div className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(56,189,248,0.25)' }} />
              <div className="absolute inset-[13%] rounded-full" style={{ border: '1px dashed rgba(34,211,238,0.32)', animation: 'spin-slow 40s linear infinite' }} />
              <div className="absolute inset-[26%] rounded-full border" style={{ border: '1px solid rgba(45,212,191,0.22)', animation: 'spin-slow-rev 30s linear infinite' }} />
              <div className="absolute inset-[26%] rounded-full" style={{ borderStyle: 'dotted', borderWidth: '1px', borderColor: 'rgba(34,211,238,0.18)', transform: 'rotate(45deg)' }} />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.26), rgba(56,189,248,0.12))', border: '1px solid rgba(34,211,238,0.45)', boxShadow: '0 0 70px rgba(34,211,238,0.35), inset 0 0 30px rgba(34,211,238,0.15)' }} />
              <div className="absolute left-1/2 -top-1 -translate-x-1/2 w-9 h-9 rounded-full anchor-glow" style={{ background: 'rgba(56,189,248,0.5)', boxShadow: '0 0 40px rgba(56,189,248,0.9)' }} />
              <div className="absolute right-0 top-1/3 w-4 h-4 rounded-full anchor-glow" style={{ background: 'rgba(45,212,191,0.55)', animationDelay: '0.4s' }} />
              <div className="absolute left-3 bottom-1/4 w-3 h-3 rounded-full anchor-glow" style={{ background: 'rgba(34,211,238,0.55)', animationDelay: '0.9s' }} />
              <div className="absolute top-[14%] left-[18%] w-2 h-2 rounded-full anchor-glow" style={{ background: 'rgba(56,189,248,0.6)', animationDelay: '0.2s' }} />
              <div className="absolute bottom-[16%] right-[20%] w-2.5 h-2.5 rounded-full anchor-glow" style={{ background: 'rgba(45,212,191,0.6)', animationDelay: '0.6s' }} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-grid-fine opacity-50" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-[230px] h-[230px] float-slow">
              <div className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(56,189,248,0.28)' }} />
              <div className="absolute inset-[18%] rounded-full" style={{ border: '1px dashed rgba(34,211,238,0.35)', animation: 'spin-slow 22s linear infinite' }} />
              <div className="absolute inset-[36%] rounded-full" style={{ border: '1px solid rgba(45,212,191,0.25)', animation: 'spin-slow-rev 16s linear infinite' }} />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-xl"
                style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.3), rgba(56,189,248,0.12))', border: '1px solid rgba(34,211,238,0.5)', boxShadow: '0 0 55px rgba(34,211,238,0.35)' }} />
              <div className="absolute left-1/2 -top-1 -translate-x-1/2 w-3 h-3 rounded-full anchor-glow" style={{ background: 'rgba(56,189,248,0.6)' }} />
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes spin-slow { to { transform: rotate(360deg); } }@keyframes spin-slow-rev { to { transform: rotate(-360deg); } }@keyframes float-slow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }@keyframes anchor-glow { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }`}</style>
    </div>
  );
}

// Catches any error inside the WebGL subtree so a broken canvas never takes
// down the page — we swap in the static industrial visual instead.
class ThreeErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.warn('[ThreeScene] 3D failed, using fallback:', error?.message || error);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const Canvas3D = lazy(() =>
  import('./Canvas3D').then((m) => ({ default: m.Canvas3D }))
);

export default function ThreeScene({
  Scene,
  sceneProps = {},
  enabled = true,
  mode = 'hero',
  className = '',
  children,
  ...canvasProps
}) {
  const [failed, setFailed] = useState(false);
  const fallback = <IndustrialFallback mode={mode} />;

  if (!enabled || failed) {
    return (
      <div className={`absolute inset-0 ${className}`}>
        {fallback}
        {children}
      </div>
    );
  }
  return (
    <div className={`absolute inset-0 ${className}`}>
      <ThreeErrorBoundary>
        <Suspense fallback={fallback}>
          <Canvas3D onContextLost={() => setFailed(true)} {...canvasProps}>
            <Scene {...sceneProps} />
          </Canvas3D>
        </Suspense>
      </ThreeErrorBoundary>
      {children}
    </div>
  );
}