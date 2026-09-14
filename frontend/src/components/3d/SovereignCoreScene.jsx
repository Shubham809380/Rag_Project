import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ParallaxGroup from './ParallaxGroup';
import TechLabel from './TechLabel';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const phaseColor = (phase) => {
  if (phase <= 0.5) return '#22d3ee';
  if (phase <= 1.5) return '#0ea5e9';
  if (phase <= 2.5) return '#34d399';
  if (phase <= 3.5) return '#fbbf24';
  return '#22d3ee';
};

function glowTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(210,245,255,1)');
  g.addColorStop(0.3, 'rgba(125,210,255,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

const CHIPS = [
  { label: 'SOVEREIGN AI CORE · LOCAL INFERENCE', pos: [0, -1.15, 0.3], color: '#67e8f9', size: 9, o: 0.85 },
  { label: 'ON-PREM · NETWORK-ISOLATED', pos: [2.1, 0.55, -0.6], color: '#dbeafe', size: 7, o: 0.45 },
  { label: 'ZERO CLOUD DEPENDENCY', pos: [-2.15, 0.9, -0.7], color: '#dbeafe', size: 7, o: 0.42 },
];

const ORBITS = [
  { tilt: [0.32, 0, 0], speed: 0.22, off: 0 },
  { tilt: [-0.22, 0.35, 0.1], speed: -0.16, off: Math.PI },
  { tilt: [0.12, -0.3, -0.12], speed: 0.12, off: Math.PI * 0.6 },
];

export default function SovereignCoreScene({ phase = 4, mode = 'landing' }) {
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const glow = useMemo(() => glowTexture(), []);
  const hot = useRef();
  const halo = useRef();
  const shell = useRef();
  const aura = useRef();
  const rings = useRef([]);
  const sats = useRef([]);
  const dust = useRef();
  const boundary = useRef();
  const segRing = useRef();
  const reds = useRef([]);
  const beamA = useRef();
  const beamB = useRef();
  const shield = useRef();
  const curr = useMemo(() => new THREE.Color('#22d3ee'), []);

  const dustGeo = useMemo(() => {
    const n = 90;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 1.7 + Math.random() * 1.5;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2.6;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r - 0.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const p = phaseRef.current;
    const focus = mode === 'auth'
      ? (document.activeElement && document.activeElement.id ? (document.activeElement.id === 'password' ? 2 : 1) : 0)
      : 0;
    const phase = clamp01(p / 4);
    const glowOn = Math.min(1, Math.max(0.15, phase));

    curr.lerp(new THREE.Color(phaseColor(p)), Math.min(delta * 1.8, 1));

    if (hot.current) {
      const s = smoothPulse(t);
      hot.current.scale.setScalar(s);
      hot.current.material.color.copy(curr);
      hot.current.material.opacity = Math.min(1, 0.16 + 0.84 * glowOn + 0.12 * Math.sin(t * 2.2));
    }
    if (halo.current) {
      const s2 = 1 + Math.sin(t * 1.6) * 0.06;
      halo.current.scale.set(s2 * 1.9, s2 * 1.9, s2 * 1.9);
      halo.current.material.opacity = 0.28 + 0.5 * glowOn;
      halo.current.material.color.copy(curr);
    }
    if (aura.current) {
      aura.current.material.opacity = (0.08 + 0.1 * Math.sin(t * 1.1)) * glowOn;
      aura.current.material.color.copy(curr);
    }
    if (shell.current) {
      shell.current.rotation.z = t * 0.12;
      shell.current.rotation.y = t * 0.3;
      shell.current.children.forEach((ch) => {
        ch.material.color.copy(curr);
        ch.material.opacity = 0.35 + 0.3 * focus + 0.15 * Math.sin(t * 1.4);
      });
    }
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      ring.rotation.x += delta * ORBITS[i].speed;
      ring.rotation.y += delta * ORBITS[i].speed * 0.4;
      const sat = sats.current[i];
      if (sat) {
        const r = 1.62;
        sat.position.set(Math.cos(t * 0.8 + ORBITS[i].off) * r, 0, Math.sin(t * 0.8 + ORBITS[i].off) * r);
        sat.material.color.copy(curr);
      }
    });
    if (dust.current) {
      dust.current.rotation.y = t * 0.03;
      dust.current.material.opacity = (0.4 + 0.15 * Math.sin(t * 0.9)) * Math.min(1, Math.max(0.25, glowOn));
    }
    if (boundary.current) {
      const act = clamp01((p - 1.2) / 1.5);
      boundary.current.material.opacity = (0.035 + 0.05 * act + 0.14 * focus) * glowOn;
      boundary.current.material.color.copy(curr);
    }
    if (segRing.current) {
      segRing.current.rotation.z = t * 0.05;
      segRing.current.material.color.copy(curr);
      segRing.current.material.opacity = (0.25 + 0.3 * focus + 0.18 * Math.sin(t * 0.7)) * Math.min(1, Math.max(0.3, glowOn));
    }
    reds.current.forEach((m, i) => {
      if (!m) return;
      const act = clamp01((p - 2.4) / 0.8);
      const blink = 0.45 + 0.55 * Math.abs(Math.sin(t * (1.2 + i * 0.31)));
      m.material.emissiveIntensity = 0.6 + 2.2 * act * blink;
      m.material.opacity = (0.4 + 0.55 * act) * glowOn;
      m.scale.setScalar(1 + 0.15 * Math.sin(t * 2 + i * 2));
    });
    if (beamA.current && beamB.current) {
      beamA.current.material.opacity = 0.05 + 0.02 * Math.sin(t * 0.5);
      beamB.current.material.opacity = 0.035 + 0.015 * Math.cos(t * 0.4 + 1);
    }
    if (shield.current) {
      const close = focus === 2 ? 1 : 0;
      shield.current.material.opacity = 0.32 * clamp01((p - 3) / 1) + 0.4 * close;
      shield.current.position.z = close * 0.35;
      shield.current.rotation.z = t * 0.4;
    }
  });

  const smoothPulse = (t) => 1 + 0.03 * Math.sin(t * 1.1);

  return (
    <ParallaxGroup>
      <ambientLight intensity={1.3} color="#bcd4ff" />
      <directionalLight position={[4, 7, 4]} intensity={2.6} color="#e8f2ff" />
      <pointLight position={[0, 0.2, 2.2]} intensity={30} distance={9} color="#8fd4ff" />

      <mesh ref={beamA} position={[-1.6, 0.8, -1.4]} rotation={[0, 0.5, 0.6]}>
        <planeGeometry args={[0.26, 5.2]} />
        <meshBasicMaterial color="#bfe9ff" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={beamB} position={[1.7, 0.1, -1.6]} rotation={[-0.2, -0.5, -0.5]}>
        <planeGeometry args={[0.18, 4.6]} />
        <meshBasicMaterial color="#a5e3ff" transparent opacity={0.035} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <sprite ref={halo} scale={[2, 2, 1]}>
        <spriteMaterial map={glow} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      <mesh ref={hot} position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.5, 48, 36]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.68, 48, 36]} />
        <meshPhysicalMaterial color="#050d17" emissive="#0ea5e9" emissiveIntensity={0.35} metalness={0.9} roughness={0.16} clearcoat={1} clearcoatRoughness={0.25} />
      </mesh>

      <group ref={shell} position={[0, 0.25, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.02, 0.012, 8, 96]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0.6]}>
          <torusGeometry args={[0.62, 0.008, 8, 72]} />
          <meshBasicMaterial color="#dbeafe" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      <mesh ref={aura} position={[0, 0.25, 0]}>
        <sphereGeometry args={[1.35, 32, 24]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>

      {ORBITS.map((o, i) => (
        <group key={i} ref={(el) => (rings.current[i] = el)} position={[0, 0.25, 0]} rotation={o.tilt}>
          <mesh>
            <torusGeometry args={[1.62, 0.01, 8, 96]} />
            <meshBasicMaterial color="#7dd3fc" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh ref={(el) => (sats.current[i] = el)}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#a5f3fc" />
          </mesh>
        </group>
      ))}

      <mesh ref={boundary} position={[0, 0.25, 0]}>
        <sphereGeometry args={[2.35, 40, 30]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.05} depthWrite={false} side={THREE.BackSide} />
      </mesh>

      <mesh ref={segRing} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.4, 0.02, 8, 96]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (reds.current[i] = el)} position={[
          Math.cos((i / 3) * Math.PI * 2 + 0.6) * 2.75,
          0.25,
          Math.sin((i / 3) * Math.PI * 2 + 0.6) * 2.75,
        ]}>
          <octahedronGeometry args={[0.075, 0]} />
          <meshStandardMaterial color="#450a0a" emissive="#f87171" emissiveIntensity={1} transparent opacity={0.5} />
        </mesh>
      ))}

      <points ref={dust} geometry={dustGeo}>
        <pointsMaterial map={glow} size={0.07} transparent opacity={0.4} depthWrite={false} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>

      {mode === 'auth' && (
        <mesh ref={shield} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.15, 0.018, 8, 80]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {CHIPS.map((c) => (
        <TechLabel key={c.label} position={c.pos} color={c.color} size={c.size} opacity={c.o}>
          {c.label}
        </TechLabel>
      ))}
    </ParallaxGroup>
  );
}