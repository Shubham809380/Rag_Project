import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import TechLabel from './TechLabel';

// Model routing is the project's core differentiator: one router, many local
// models, and a visible decision about which model handles the task.
const MODELS = [
  { id: 0, label: 'TEXT MODEL', pos: [2.7, 1.9, 0], color: '#38bdf8' },
  { id: 1, label: 'VISION MODEL', pos: [2.7, 0.6, 0], color: '#2dd4bf' },
  { id: 2, label: 'EMBEDDING', pos: [2.7, -0.7, 0], color: '#22d3ee' },
  { id: 3, label: 'CODING MODEL', pos: [2.7, -2.0, 0], color: '#a78bfa' },
];

const TASKS = [
  { label: 'Analyze scanned inspection report', route: [1, 0] },
  { label: 'Analyze Python code', route: [3] },
  { label: 'Embed maintenance SOPs', route: [2] },
  { label: 'Summarize technical manual', route: [0] },
];

function NodeBox({ pos, color, label, active }) {
  const ref = useRef();
  const glow = useRef();
  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = ref.current.material.emissiveIntensity;
    const target = active ? 1.7 : 0.35;
    ref.current.material.emissiveIntensity += (target - t) * delta * 4;
    if (glow.current) {
      const m = glow.current.material;
      const op = active ? 0.5 : 0.12;
      m.opacity += (op - m.opacity) * delta * 4;
    }
  });
  return (
    <group position={pos}>
      <mesh ref={ref}>
        <boxGeometry args={[0.62, 0.4, 0.4]} />
        <meshStandardMaterial color={active ? '#13304a' : '#0e2033'} emissive={color} emissiveIntensity={0.35} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.34, 0, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={glow} position={[0, 0, 0.28]}>
        <planeGeometry args={[1.1, 0.7]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <TechLabel position={[0, -0.42, 0]} color={active ? color : '#7d94b0'} size={8} opacity={active ? 1 : 0.6}>
        {label}
      </TechLabel>
    </group>
  );
}

function RouterHub() {
  const ref = useRef();
  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * 0.5;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.2;
  });
  return (
    <group position={[-1.1, 0.15, 0]}>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#0e2a42" emissive="#38bdf8" emissiveIntensity={1.1} metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 20, 16]} />
        <meshBasicMaterial color="#dff3ff" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.72, 0.02, 8, 48]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} />
      </mesh>
      <TechLabel position={[0, -0.62, 0]} color="#38bdf8" size={9} opacity={0.9}>
        MODEL ROUTER
      </TechLabel>
    </group>
  );
}

export default function ModelRouterScene({ target, autoCycle = true }) {
  const [current, setCurrent] = useState(0);
  const packet = useRef();
  const t = useRef(0);
  const active = typeof target === 'number' ? target : current;

  useEffect(() => {
    if (!autoCycle) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % MODELS.length), 3200);
    return () => clearInterval(id);
  }, [autoCycle]);

  const arrowGeo = useMemo(() => {
    const pts = [
      [-3.2, 1.55, 0],
      [-2.1, 1.3, 0],
      [-1.7, 0.75, 0],
      [-1.6, 0.4, 0],
    ].map((p) => new THREE.Vector3(...p));
    const g = new THREE.BufferGeometry();
    g.setFromPoints(pts);
    return g;
  }, []);
  const toModel = MODELS[active];

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    t.current += dt * 0.55;
    const prog = (t.current % 1.0);
    let pos;
    if (prog < 0.42) {
      const s = prog / 0.42;
      pos = new THREE.Vector3(-3.2 + (1.6) * s, 1.55 - 1.15 * s, 0);
    } else if (prog < 0.58) {
      pos = new THREE.Vector3(-1.6, 0.4, 0);
    } else {
      const s = (prog - 0.58) / 0.42;
      pos = new THREE.Vector3(
        -1.6 + (toModel.pos[0] + 1.6) * s,
        0.4 + (toModel.pos[1] - 0.4) * s,
        0,
      );
    }
    if (packet.current) {
      packet.current.position.set(pos.x, pos.y, pos.z);
      const m = packet.current.material;
      m.opacity = prog > 0.98 ? 1 - (prog - 0.98) * 50 : 1;
    }
  });

  return (
    <group>
      <NodeBox pos={MODELS[0].pos} color={MODELS[0].color} label={MODELS[0].label} active={active === 0} />
      <NodeBox pos={MODELS[1].pos} color={MODELS[1].color} label={MODELS[1].label} active={active === 1} />
      <NodeBox pos={MODELS[2].pos} color={MODELS[2].color} label={MODELS[2].label} active={active === 2} />
      <NodeBox pos={MODELS[3].pos} color={MODELS[3].color} label={MODELS[3].label} active={active === 3} />
      <RouterHub />
      <line geometry={arrowGeo}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.35} depthWrite={false} />
      </line>
      <mesh ref={packet}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshBasicMaterial color="#7fd4ff" />
        <pointLight distance={2.5} intensity={5} color="#7fd4ff" />
      </mesh>
      <Html position={[-3.2, 2.15, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: 8, fontFamily: "'Fira Code', monospace", letterSpacing: '0.12em', color: '#8fb3de' }}>
          TASK · {TASKS[active].label.toUpperCase()}
        </div>
      </Html>
    </group>
  );
}