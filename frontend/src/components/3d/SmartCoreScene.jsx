import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Float } from '@react-three/drei';
import * as THREE from 'three';

const DEFAULT_MODULES = [
  { id: 'docs', label: 'Documents', desc: 'Plant knowledge base', tone: '#3b82f6', to: '/workbench/documents' },
  { id: 'agent', label: 'AI Workbench', desc: 'Agentic task orchestration', tone: '#22d3ee', to: '/workbench/agent' },
  { id: 'data', label: 'Data Analysis', desc: 'Local statistical profiles', tone: '#a78bfa', to: '/workbench/data-analysis' },
  { id: 'vision', label: 'Vision Analysis', desc: 'On-device multimodal inspection', tone: '#f472b6', to: '/workbench/vision' },
  { id: 'coding', label: 'Coding', desc: 'Sandboxed code execution', tone: '#38bdf8', to: '/workbench/coding' },
  { id: 'deliverables', label: 'Deliverables', desc: 'Word / Excel / PDF artifacts', tone: '#34d399', to: '/workbench/deliverables' },
  { id: 'approvals', label: 'Approvals', desc: 'Human-in-the-loop governance', tone: '#fbbf24', to: '/workbench/approvals' },
  { id: 'sovereignty', label: 'Sovereignty', desc: 'Network egress monitoring', tone: '#fb7185', to: '/workbench/sovereignty' },
];

function Core() {
  const ref = useRef();
  const inner = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.18;
    ref.current.rotation.x = Math.sin(t * 0.12) * 0.25;
    inner.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.12);
  });
  return (
    <group position={[0, 0, 0]}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color="#12203a" emissive="#22d3ee" emissiveIntensity={0.55} metalness={0.85} roughness={0.3} wireframe />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.34, 1]} />
        <meshStandardMaterial color="#0e1b30" emissive="#38bdf8" emissiveIntensity={1.1} metalness={0.6} roughness={0.25} flatShading />
      </mesh>
      <pointLight position={[0, 0, 1.6]} intensity={16} distance={7} color="#22d3ee" />
    </group>
  );
}

function Ring({ radius, y, speed, tilt }) {
  const ref = useRef();
  useFrame((state) => {
    ref.current.rotation.z += state.clock.getDelta() * speed;
  });
  return (
    <group ref={ref} position={[0, y, 0]} rotation-x={tilt}>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[radius, 0.025, 8, 80]} />
        <meshBasicMaterial color="#2a5e96" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export default function SmartCoreScene({ modules = DEFAULT_MODULES, onNavigate }) {
  const ref = useRef();
  const [active, setActive] = useState(null);

  const nodes = useMemo(() => {
    const R = 2.0;
    const RR = 2.9;
    return modules.map((m, i) => {
      const isOuter = i % 2 === 0;
      const r = isOuter ? RR : R;
      const n = isOuter ? Math.ceil((modules.length - (modules.length % 2)) / 2) : Math.floor(modules.length / 2);
      const idx = isOuter ? Math.floor(i / 2) : Math.floor((i - 1) / 2);
      const angle = (idx / Math.max(1, n)) * Math.PI * 2 + 0.2;
      return {
        ...m,
        radius: r,
        yOffset: isOuter ? -0.15 : 0.55,
        position: new THREE.Vector3(Math.cos(angle) * r, (isOuter ? -0.55 : 0.35) + Math.sin(angle * 2) * 0.12, Math.sin(angle) * r),
      };
    });
  }, [modules]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.05;
    const px = state.pointer.x * 0.2;
    const py = state.pointer.y * 0.14;
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, px, 0.05);
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, py, 0.05);
  });

  return (
    <group ref={ref}>
      <Core />
      <Html center distanceFactor={9} position={[0, -1.35, 0.8]} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div className="mono-chip px-2 py-1 text-center">
          <div className="text-[9px] font-bold tracking-[0.2em]" style={{ color: '#38BDF8' }}>SOVEREIGN CORE</div>
          <div className="text-[8.5px] mt-0.5 tracking-[0.22em] opacity-80" style={{ color: '#7dd3fc' }}>MRPL · SMART AUTOMATION</div>
        </div>
      </Html>
      <Ring radius={1.45} y={-0.05} speed={0.12} tilt={1.35} />
      <Ring radius={2.55} y={0.12} speed={-0.07} tilt={1.15} />
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.7}>
        <group>
          {nodes.map((n) => (
            <group key={n.id} position={n.position}>
              <mesh
                onPointerOver={(e) => { e.stopPropagation(); setActive(n.id); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setActive(null); document.body.style.cursor = 'auto'; }}
                onClick={(e) => { e.stopPropagation(); onNavigate?.(n.to); }}
              >
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial
                  color={active === n.id ? n.tone : '#12203a'}
                  emissive={n.tone}
                  emissiveIntensity={active === n.id ? 1.6 : 0.85}
                  metalness={0.7}
                  roughness={0.3}
                />
              </mesh>
              {/* connector tether */}
              <mesh>
                <cylinderGeometry args={[0.012, 0.012, n.position.length(), 6]} />
                <meshBasicMaterial color={n.tone} transparent opacity={0.35} />
              </mesh>
              {active === n.id && (
                <Html center position={[0, 1.05, 0]} zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
                  <div className="float-card px-3 py-2 min-w-[150px]" style={{ pointerEvents: 'none' }}>
                    <div className="text-[12px] font-semibold" style={{ color: '#fff' }}>{n.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#9aa7bc' }}>{n.desc}</div>
                    <div className="mt-1.5 text-[9px] font-mono uppercase tracking-wider" style={{ color: n.tone }}>Open →</div>
                  </div>
                </Html>
              )}
            </group>
          ))}
        </group>
      </Float>
    </group>
  );
}