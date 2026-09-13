import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// Subtle mouse interaction: the wrapped content eases toward the pointer
// position instead of jumping. Rotation stays tiny — the page never tilts.
export default function ParallaxGroup({ children, amount = 0.07, damp = 0.05, ...rest }) {
  const ref = useRef(null);
  useFrame((state) => {
    const r = ref.current;
    if (!r) return;
    const tx = -state.pointer.x * amount;
    const ty = -state.pointer.y * amount * 0.65;
    r.rotation.y += (tx - r.rotation.y) * damp;
    r.rotation.x += (ty - r.rotation.x) * damp;
  });
  return (
    <group ref={ref} {...rest}>
      {children}
    </group>
  );
}