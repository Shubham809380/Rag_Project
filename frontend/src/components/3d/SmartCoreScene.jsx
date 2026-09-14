import { useCallback, useMemo, useRef, useState } from 'react';
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

const GEAR_TEETH = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);
const BOUND_RADIUS = 2.4;
const BOUND_Y_MIN = -1.5;
const BOUND_Y_MAX = 1.7;

// "Smart Automation Core" — a gear-driven automation hub. The shell is an
// octahedron cage, a driven gear ring orbits inside it, and a glowing brain
// sphere sits at the center. The whole assembly can be grabbed and dragged
// around the scene (a movable 3D object) and double-clicked to reset home.
function Core() {
  const shell = useRef();
  const gear = useRef();
  const brain = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (shell.current) {
      shell.current.rotation.y = t * 0.22;
      shell.current.rotation.x = Math.sin(t * 0.14) * 0.3;
    }
    if (gear.current) gear.current.rotation.z += state.delta * 0.7;
    if (brain.current) brain.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.12);
  });

  return (
    <group>
      {/* outer cage */}
      <mesh ref={shell}>
        <octahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial color="#12203a" emissive="#22d3ee" emissiveIntensity={0.5} metalness={0.85} roughness={0.3} wireframe />
      </mesh>
      {/* driven gear ring */}
      <group ref={gear}>
        <mesh rotation-x={Math.PI / 2}>
          <ringGeometry args={[0.6, 0.84, 32]} />
          <meshStandardMaterial color="#0e2238" emissive="#38bdf8" emissiveIntensity={0.35} metalness={0.8} roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
        {GEAR_TEETH.map((a, i) => (
          <mesh
            key={i}
            rotation={[0, 0, a]}
            position={[0, 0.74, 0]}
            rotation-order="ZYX"
          >
            <boxGeometry args={[0.09, 0.3, 0.1]} />
            <meshStandardMaterial color="#16324f" emissive="#38bdf8" emissiveIntensity={0.5} metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {/* core brain */}
      <mesh ref={brain}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial color="#0b1526" emissive="#7dd3fc" emissiveIntensity={1.5} metalness={0.5} roughness={0.2} />
      </mesh>
      <pointLight position={[0, 0, 1.6]} intensity={16} distance={7} color="#22d3ee" />
    </group>
  );
}

function Ring({ radius, y, speed, tilt }) {
  const ref = useRef();
  useFrame((state) => {
    ref.current.rotation.z += state.delta * speed;
  });
  return (
    <group ref={ref} position={[0, y, 0]} rotation-x={tilt}>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[radius, 0.025, 8, 80]} />
        <meshBasicMaterial color="#2a5e96" transparent opacity={0.8} />
      </mesh>
      <mesh position={[radius * 0.82, 0, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#7dd3fc" />
      </mesh>
      <pointLight position={[radius * 0.82, 0, 0]} intensity={2} distance={1.4} color="#7dd3fc" />
    </group>
  );
}

export default function SmartCoreScene({ modules = DEFAULT_MODULES, onNavigate }) {
  const ref = useRef();
  const [active, setActive] = useState(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const pointerDown = useRef(null);

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

  // ── drag-to-move: grab the assembly and slide it around in 3D ──────────
  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    const ev = e.nativeEvent;
    ev.preventDefault?.();
    if (!ref.current) return;
    const p = ref.current.position;
    pointerDown.current = { id: ev.pointerId, startX: ev.clientX, startY: ev.clientY, homeX: p.x, homeY: p.y };
    setDragging(true);
    document.body.style.cursor = 'grabbing';

    const onMove = (me) => {
      if (!pointerDown.current || me.pointerId !== pointerDown.current.id) return;
      const dx = (me.clientX - pointerDown.current.startX) * 0.012;
      const dy = -(me.clientY - pointerDown.current.startY) * 0.012;
      const tx = THREE.MathUtils.clamp(pointerDown.current.homeX + dx, -BOUND_RADIUS, BOUND_RADIUS);
      const ty = THREE.MathUtils.clamp(pointerDown.current.homeY + dy, BOUND_Y_MIN, BOUND_Y_MAX);
      drag.current = { tx, ty };
    };
    const onUp = (ue) => {
      if (ue.pointerId !== pointerDown.current?.id) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      pointerDown.current = null;
      setDragging(false);
      document.body.style.cursor = 'auto';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const resetHome = useCallback((e) => {
    e?.stopPropagation();
    drag.current = { tx: 0, ty: 0 };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // gentle auto-rotation; paused while the user grabs the object
    if (!dragging) ref.current.rotation.y = t * 0.05;
    // pointer parallax when not dragging
    if (!dragging) {
      ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, state.pointer.x * 0.2, 0.05);
      ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, state.pointer.y * 0.14, 0.05);
    }
    // ease toward the drag target
    if (drag.current) {
      ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, drag.current.tx, 0.28);
      ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, drag.current.ty, 0.28);
      if (Math.abs(ref.current.position.x - drag.current.tx) < 0.01 && Math.abs(ref.current.position.y - drag.current.ty) < 0.01) {
        ref.current.position.x = drag.current.tx;
        ref.current.position.y = drag.current.ty;
        drag.current = null;
      }
    }
  });

  return (
    <group
      ref={ref}
      onPointerDown={handlePointerDown}
      onDoubleClick={resetHome}
      onPointerOver={(e) => { e.stopPropagation(); if (!dragging) document.body.style.cursor = 'grab'; }}
      onPointerOut={() => { if (!dragging) document.body.style.cursor = 'auto'; }}
    >
      <Core />
      <Html center distanceFactor={9} position={[0, -1.35, 0.8]} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div className="mono-chip px-2 py-1 text-center">
          <div className="text-[9px] font-bold tracking-[0.2em]" style={{ color: '#38BDF8' }}>SOVEREIGN CORE</div>
          <div className="text-[8.5px] mt-0.5 tracking-[0.22em] opacity-80" style={{ color: '#7dd3fc' }}>ON-PREMISE · INDUSTRIAL AUTOMATION</div>
        </div>
      </Html>
      <Ring radius={1.45} y={-0.05} speed={0.12} tilt={1.35} />
      <Ring radius={2.55} y={0.12} speed={-0.07} tilt={1.15} />
      {/* air-gap boundary frame */}
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[3.34, 0.014, 8, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[3.62, 0.01, 8, 96]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <group position={[3.62, 0.05, 0.15]} rotation={[0.2, 0, 0]}>
        <mesh rotation-z={Math.PI / 4}>
          <boxGeometry args={[0.04, 0.5, 0.04]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
        <mesh rotation-z={-Math.PI / 4}>
          <boxGeometry args={[0.04, 0.5, 0.04]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
      </group>
      <Html center distanceFactor={8} position={[0, 1.95, 0.4]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="mono-chip px-2 py-0.5" style={{ borderColor: 'rgba(34,211,238,0.3)', color: '#38bdf8' }}>NETWORK-ISOLATED · LOCAL ONLY</div>
      </Html>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.7}>
        <group>
          {nodes.map((n) => (
            <group key={n.id} position={n.position}>
              <mesh
                onPointerOver={(e) => { e.stopPropagation(); setActive(n.id); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setActive(null); if (!dragging) document.body.style.cursor = 'auto'; }}
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