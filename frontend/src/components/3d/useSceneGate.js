import { useEffect, useState } from 'react';

// Mounts a WebGL scene only when its container approaches the viewport, then
// keeps it alive. Limits the number of concurrent GPU contexts on the page —
// the exact cause of "3D flashes and disappears" on weak industrial hardware.
export default function useSceneGate(ref, rootMargin = '300px 0px 300px 0px') {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setOn(true);
        io.disconnect();
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, ref]);
  return on;
}