import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const NODES = [
  { x: -4.6, color: '#22d3ee', label: 'INPUT', sub: 'Docs · drawings · prompts', kind: 'input' },
  { x: -1.6, color: '#38bdf8', label: 'PROCESSING', sub: 'OCR · embed · retrieve', kind: 'process' },
  { x: 1.6, color: '#2dd4bf', label: 'AUTOMATION', sub: 'Agent tools · sandbox', kind: 'automation' },
  { x: 4.6, color: '#34d399', label: 'OUTPUT', sub: 'Approved deliverables', kind: 'output' },
];

function NodeMesh({ x, color, label, sub }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.35 + x;
    ref.current.rotation.x = Math.sin(t * 0.25 + x) * 0.15;
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial color="#12203a" emissive={color} emissiveIntensity={0.9} metalness={0.7} roughness={0.3} transparent opacity={0.95} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.9, 0.03, 10, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} transparent opacity={0.7} />
      </mesh>
      {/* core spark */}
      <mesh>
        <sphereGeometry args={[0.16, 14, 14]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight position={[0, 0, 1]} intensity={9} distance={4.5} color={color} />
      <Html center distanceFactor={14} position={[0, -1.15, 0.35]} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div className="mono-chip px-2 py-1 text-center" style={{ borderColor: `${color}55`, color }}>
          <div className="text-[9px] font-bold tracking-[0.18em]">{label}</div>
          <div className="text-[8.5px] mt-0.5 opacity-80 tracking-wider">{sub}</div>
        </div>
      </Html>
    </group>
  );
}

function TravellingParticles({ from, to, count = 14, color }) {
  const refs = useRef([]);
  const offsets = useMemo(() => Array.from({ length: count }, (_, i) => (i / count)), [count]);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.55;
    refs.current.forEach((r, i) => {
      if (!r) return;
      const s = (t + offsets[i]) % 1;
      r.position.set(
        from + (to - from) * s,
        Math.sin(s * Math.PI) * 0.55,
        0,
      );
      const m = r.material;
      m.opacity = 0.5 + Math.sin(s * Math.PI) * 0.4;
    });
  });
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => (refs.current[i] = el)}
          position={[from, 0, 0]}
        >
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Link({ from, to, color }) {
  const mid = (from + to) / 2;
  const pts = useMemo(() => [
    new THREE.Vector3(from, 0, 0),
    new THREE.Vector3(mid, 0.7, 0),
    new THREE.Vector3(to, 0, 0),
  ], [from, to, mid]);
  const ref = useRef();
  useFrame(() => {
    const g = ref.current.geometry;
    g.setFromPoints(pts);
  });
  return (
    <line ref={ref}>
      <bufferGeometry />
      <lineBasicMaterial color={color} transparent opacity={0.4} />
    </line>
  );
}

export default function AutomationNetworkScene() {
  const links = useMemo(() => [
    { from: NODES[0].x, to: NODES[1].x, color: NODES[0].color },
    { from: NODES[1].x, to: NODES[2].x, color: NODES[1].color },
    { from: NODES[2].x, to: NODES[3].x, color: NODES[2].color },
  ], []);
  return (
    <group position={[0, 0.2, 0]}>
      {NODES.map((n) => (
        <NodeMesh key={n.x} x={n.x} color={n.color} label={n.label} sub={n.sub} />
      ))}
      {links.map((l, i) => (
        <group key={i}>
          <Link from={l.from} to={l.to} color={l.color} />
          <TravellingParticles from={l.from} to={l.to} color={l.color} count={12} />
        </group>
      ))}
      <gridHelper args={[16, 14, '#1d4a77', '#111d33']} position={[0, -1.3, 0]} />
    </group>
  );
}