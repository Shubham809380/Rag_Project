import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';

export function Canvas3D({ children, onContextLost, ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current && ref.current.querySelector('canvas');
    if (!el) return;
    const handler = () => onContextLost?.();
    el.addEventListener('webglcontextlost', handler);
    return () => el.removeEventListener('webglcontextlost', handler);
  }, [onContextLost]);

  return (
    <div ref={ref} className="absolute inset-0">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 1.6, 7.5], fov: 42 }}
        style={{ position: 'absolute', inset: 0 }}
        {...props}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 5]} intensity={0.9} color="#cfe8ff" />
        <pointLight position={[-5, 2, -4]} intensity={18} color="#22d3ee" distance={22} />
        <pointLight position={[5, -2, -3]} intensity={14} color="#38bdf8" distance={22} />
        <pointLight position={[0, 4, 2]} intensity={10} color="#2dd4bf" distance={20} />
        {children}
        <fog attach="fog" args={['#05070C', 9, 22]} />
      </Canvas>
    </div>
  );
}