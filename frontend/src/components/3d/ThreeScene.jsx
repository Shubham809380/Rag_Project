import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
          <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, #070c18 0%, #05070c 100%)' }}>
            <div className="absolute -top-1/4 -left-1/4 w-[70vw] h-[70vw] max-w-[820px] max-h-[820px] rounded-full aurora-a" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.14), transparent 68%)', filter: 'blur(70px)', animationDuration: '18s' }} />
            <div className="absolute -bottom-1/5 right-0 w-[62vw] h-[62vw] max-w-[720px] max-h-[720px] rounded-full aurora-b" style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12), transparent 68%)', filter: 'blur(70px)', animationDuration: '22s' }} />
            <div className="absolute top-[12%] left-[42%] w-[38vw] h-[38vw] max-w-[460px] max-h-[460px] rounded-full aurora-c" style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.11), transparent 64%)', filter: 'blur(60px)', animationDuration: '16s' }} />
            <div className="absolute -bottom-1/6 left-[8%] w-[48vw] h-[48vw] max-w-[560px] max-h-[560px] rounded-full aurora-d" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.06), transparent 62%)', filter: 'blur(70px)', animationDuration: '20s' }} />
          </div>
          <div className="absolute inset-0 bg-grid-fine opacity-55" />
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
      <style>{`@keyframes spin-slow { to { transform: rotate(360deg); } }@keyframes spin-slow-rev { to { transform: rotate(-360deg); } }@keyframes float-slow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }@keyframes anchor-glow { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }@keyframes aurora-a { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.15; } 50% { transform: translate(8%,12%) scale(1.12); opacity: 0.09; } }@keyframes aurora-b { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.14; } 50% { transform: translate(-10%,8%) scale(1.18); opacity: 0.08; } }@keyframes aurora-c { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.13; } 50% { transform: translate(5%,-8%) scale(1.1); opacity: 0.07; } }@keyframes aurora-d { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.12; } 50% { transform: translate(6%,10%) scale(1.15); opacity: 0.06; } }`}</style>
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
  const failTimer = useRef(null);
  // Context loss is often transient (drivers reset, StrictMode double-mounts).
  // Only treat it as a failure if the GPU cannot recover within ~1.2s, and
  // revert to WebGL as soon as the context is restored — no flash to fallback.
  const handleContextLost = useCallback(() => {
    if (failTimer.current) clearTimeout(failTimer.current);
    failTimer.current = setTimeout(() => setFailed(true), 1200);
  }, []);
  const handleContextRestored = useCallback(() => {
    if (failTimer.current) clearTimeout(failTimer.current);
    failTimer.current = null;
    setFailed(false);
  }, []);
  useEffect(() => () => { if (failTimer.current) clearTimeout(failTimer.current); }, []);
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
          <Canvas3D onContextLost={handleContextLost} onContextRestored={handleContextRestored} {...canvasProps}>
            <Scene {...sceneProps} />
          </Canvas3D>
        </Suspense>
      </ThreeErrorBoundary>
      {children}
    </div>
  );
}