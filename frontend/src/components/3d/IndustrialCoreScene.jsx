import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Line } from '@react-three/drei';
import * as THREE from 'three';

const ACCENT = '#22d3ee';
const ACCENT_B = '#38bdf8';

// Subtle pointer parallax on the camera — respectful, not gimmicky.
function Rig({ children }) {
  const ref = useRef();
  const spin = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const px = state.pointer.x;
    const py = state.pointer.y;
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, px * 0.55, 0.06);
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, 1.5 + py * 0.35 + Math.sin(t * 0.22) * 0.18, 0.06);
    ref.current.rotation.z = Math.sin(t * 0.09) * 0.03;
    spin.current.rotation.y = Math.sin(t * 0.05) * 0.1;
  });
  return (
    <group ref={spin}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

function ReactorCore() {
  const ring = useRef();
  const ring2 = useRef();
  const pulse = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ring.current.rotation.y = t * 0.3;
    ring.current.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.22) * 0.12;
    ring2.current.rotation.y = -t * 0.22;
    ring2.current.rotation.x = Math.PI / 2.7 + Math.cos(t * 0.18) * 0.1;
    const s = 1 + Math.sin(t * 1.1) * 0.35;
    pulse.current.scale.setScalar(s);
    pulse.current.material.opacity = 0.16 - Math.sin(t * 1.1) * 0.1;
  });
  return (
    <group position={[0, 0.15, 0]}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[1.05, 1.2, 1.5, 20, 1]} />
        <meshStandardMaterial
          color="#1a2d4a"
          metalness={0.85}
          roughness={0.3}
          emissive="#14304f"
          emissiveIntensity={0.9}
        />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[1.2, 1.05, 0.5, 20, 1]} />
        <meshStandardMaterial color="#24405f" metalness={0.8} roughness={0.36} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <cylinderGeometry args={[0.4, 0.55, 0.6, 20, 1]} />
        <meshStandardMaterial color="#2a4b75" metalness={0.7} roughness={0.35} emissive={ACCENT} emissiveIntensity={0.5} />
      </mesh>
      {/* pulsing energy halo */}
      <mesh ref={pulse} position={[0, 0.55, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.35, 1.62, 48]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.15} depthWrite={false} side={2} />
      </mesh>
      <group ref={ring}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.7, 0.07, 12, 72]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={2.4} metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[1.7, 0, 0]} rotation-x={Math.PI / 2}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshBasicMaterial color={ACCENT_B} />
        </mesh>
        <mesh position={[-1.7, 0, 0]} rotation-x={Math.PI / 2}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshBasicMaterial color="#2dd4bf" />
        </mesh>
      </group>
      <group ref={ring2}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.4, 0.04, 10, 60]} />
          <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={1.6} metalness={0.5} roughness={0.3} transparent opacity={0.8} />
        </mesh>
      </group>
      {/* glow plate */}
      <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.5, 48]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.35, 1.7, 48]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Tower({ position, scale = 1, tilt = 0 }) {
  return (
    <Float speed={1.2} rotationIntensity={0.12} floatIntensity={0.6} position={position}>
      <group scale={scale} rotation-z={tilt}>
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.16, 0.24, 2.4, 10]} />
          <meshStandardMaterial color="#1d2f4d" metalness={0.82} roughness={0.34} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.3, 0.34, 0.9, 10]} />
          <meshStandardMaterial color="#203a5e" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 2.6, 0]}>
          <sphereGeometry args={[0.28, 12, 12]} />
          <meshStandardMaterial color="#14304f" emissive={ACCENT_B} emissiveIntensity={1.2} metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
          <meshStandardMaterial color="#2d4ca1" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </Float>
  );
}

function FlareStack({ position }) {
  const glow = useRef();
  useFrame((state) => {
    const f = 0.5 + Math.sin(state.clock.elapsedTime * 1.6) * 0.5;
    glow.current.scale.setScalar(0.7 + f * 0.7);
    glow.current.material.opacity = 0.5 + f * 0.4;
  });
  return (
    <group position={position}>
      <mesh position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.03, 0.06, 3.6, 8]} />
        <meshStandardMaterial color="#2a4470" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, 3.8, 0]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.12, 0.04, 8, 24]} />
        <meshBasicMaterial color={ACCENT} />
      </mesh>
      <mesh ref={glow} position={[0, 3.98, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.55} />
      </mesh>
      <pointLight position={[0, 3.9, 0]} intensity={4} distance={3} color={ACCENT} />
    </group>
  );
}

function PipeArc({ points, color = ACCENT }) {
  return (
    <Line points={points} color={color} lineWidth={1.2} transparent opacity={0.24} />
  );
}

// A glowing packet travelling along a pipe — represents RAG retrieval flow
// between the local knowledge store and the reactor.
function FlowDot({ pts, color = ACCENT, speed = 0.35, offset = 0 }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset;
    const s = t % 1;
    const seg = s * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(seg));
    const f = seg - i;
    const a = pts[i];
    const b = pts[i + 1];
    const x = a[0] + (b[0] - a[0]) * f;
    const y = a[1] + (b[1] - a[1]) * f;
    const z = a[2] + (b[2] - a[2]) * f;
    ref.current.position.set(x, y, z);
    ref.current.material.opacity = 0.55 + Math.sin(s * Math.PI) * 0.45;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial color={color} transparent />
    </mesh>
  );
}

// A ring of thin "documents" orbiting the core — the plant knowledge base in motion.
function DocOrbit() {
  const ref = useRef();
  const docs = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      tilt: (i % 3) * 0.12,
    })), []);
  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * 0.1;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.14) * 0.1;
  });
  return (
    <group ref={ref} position={[0, 0.7, 0]}>
      {docs.map((d, i) => (
        <group key={i} rotation={[0, d.angle, 0]}>
          <mesh position={[2.25, 0, 0]} rotation={[0, 0, 0.15 + d.tilt]}>
            <boxGeometry args={[0.42, 0.02, 0.3]} />
            <meshStandardMaterial color="#1b3a5c" emissive="#38bdf8" emissiveIntensity={0.45} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[2.25, 0.03, 0]} rotation={[0, 0, 0.15 + d.tilt]}>
            <boxGeometry args={[0.3, 0.008, 0.026]} />
            <meshBasicMaterial color="#2dd4bf" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DataNodes() {
  const nodes = useMemo(() => [
    { p: [-3.1, 1.35, 0.6], c: ACCENT },
    { p: [3.4, 2.4, -0.8], c: ACCENT_B },
    { p: [-2.2, 2.9, -1.4], c: '#2dd4bf' },
    { p: [2.6, 0.5, 1.6], c: ACCENT_B },
    { p: [0.4, 2.4, -2.2], c: ACCENT },
    { p: [-1.6, 0.4, 2.3], c: '#2dd4bf' },
  ], []);
  return (
    <group>
      {nodes.map((n, i) => (
        <Float key={i} speed={1.8 + i * 0.2} rotationIntensity={0.5} floatIntensity={1.4}>
          <mesh position={n.p}>
            <octahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial color={n.c} emissive={n.c} emissiveIntensity={2} metalness={0.6} roughness={0.25} />
          </mesh>
          <pointLight position={n.p} intensity={2.5} distance={2.2} color={n.c} />
        </Float>
      ))}
    </group>
  );
}

function Particles() {
  const pts = useMemo(() => {
    const n = 420;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 2.4 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      const y = -0.6 + Math.random() * 4.4;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.015;
    ref.current.position.y = Math.sin(t * 0.2) * 0.05;
  });
  return (
    <points ref={ref} geometry={pts} position={[0, 0, 0]}>
      <pointsMaterial size={0.04} color="#7dd3fc" transparent opacity={0.8} depthWrite={false} sizeAttenuation />
    </points>
  );
}

export default function IndustrialCoreScene() {
  return (
    <Rig>
      <gridHelper args={[42, 42, '#1d4a77', '#111d33']} position={[0, -1.55, 0]} />
      <ReactorCore />
      <DocOrbit />
      <Tower position={[-2.6, -1.2, 1.6]} scale={0.82} tilt={0.04} />
      <Tower position={[2.9, -1.2, 1.2]} scale={0.7} tilt={-0.03} />
      <Tower position={[1.4, -1.2, -2.7]} scale={0.9} tilt={0.01} />
      <Tower position={[-1.8, -1.2, -2.3]} scale={0.64} tilt={-0.05} />
      <FlareStack position={[-3.4, -1.5, -1.1]} />
      <FlareStack position={[3.2, -1.5, -1.9]} />
      <PipeArc points={[[-2.6, 0.7, 1.6], [-0.4, 0.9, 0.9], [1.4, 0.8, 1.2]]} />
      <PipeArc points={[[-1.8, 1.2, -2.3], [-0.5, 1.05, -1.7], [0.4, 0.95, -2.2]]} />
      <PipeArc points={[[2.9, 0.6, 1.2], [2.1, 0.7, 0.4]]} />
      <FlowDot pts={[[-2.6, 0.7, 1.6], [-0.4, 0.9, 0.9], [1.4, 0.8, 1.2]]} speed={0.42} offset={0} />
      <FlowDot pts={[[-2.6, 0.7, 1.6], [-0.4, 0.9, 0.9], [1.4, 0.8, 1.2]]} speed={0.42} offset={0.55} />
      <FlowDot pts={[[-1.8, 1.2, -2.3], [-0.5, 1.05, -1.7], [0.4, 0.95, -2.2]]} speed={0.38} offset={0.2} />
      <DataNodes />
      <Particles />
    </Rig>
  );
}