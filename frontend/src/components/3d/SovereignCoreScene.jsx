import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ParallaxGroup from './ParallaxGroup';
import TechLabel from './TechLabel';

// Hard arc of a circle the labels sit inside, so rotating rings never clip into
// the nothing — this scene drives its own arcs, no external files.
const smooth = (a, b, t) => a + (b - a) * t;

const SERVICES = [
  { label: 'LOCAL LLM', a: Math.PI * 0.32, color: '#34d399' },
  { label: 'EMBEDDING', a: Math.PI * 0.56, color: '#38bdf8' },
  { label: 'RAG', a: Math.PI * 0.8, color: '#22d3ee' },
  { label: 'VISION', a: Math.PI * 1.04, color: '#2dd4bf' },
  { label: 'AGENT RT', a: Math.PI * 1.28, color: '#34d399' },
];

function makeCircle(radius, segments, a0 = 0) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return pts;
}

function BoundaryRing({ radius = 3.05, segments = 72 }) {
  const ref = useRef();
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints(makeCircle(radius, segments));
    return g;
  }, [radius, segments]);
  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * -0.05;
  });
  return (
    <lineLoop ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#38bdf8" transparent opacity={0.4} depthWrite={false} />
    </lineLoop>
  );
}

function BoundarySegments({ focusRef }) {
  const ref = useRef();
  const segs = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      arr.push({
        a,
        x: Math.cos(a) * 3.05,
        z: Math.sin(a) * 3.05,
      });
    }
    return arr;
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.06;
    const focus = focusRef && focusRef.current ? focusRef.current : 0;
    const glowB = 0.5 + Math.sin(t * 1.2) * 0.2 + focus * 0.7;
    ref.current.children.forEach((seg) => {
      seg.rotation.z += state.delta * 0.4;
      if (seg.material) seg.material.emissiveIntensity = glowB;
      if (seg.children[1] && seg.children[1].material) seg.children[1].material.opacity = 0.42 + focus * 0.5;
    });
  });
  return (
    <group ref={ref}>
      {segs.map((s, i) => (
        <group key={i} position={[s.x * 0.99, 0, s.z * 0.99]}>
          <mesh>
            <boxGeometry args={[0.055, 0.055, 0.055]} />
            <meshStandardMaterial color="#0d3a55" emissive="#38bdf8" emissiveIntensity={1} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.13, 0.012, 6, 28]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BlockedAttempts({ phaseRef }) {
  const refs = useRef([]);
  const marks = useMemo(() => {
    return Array.from({ length: 4 }).map(() => ({
      a: Math.random() * Math.PI * 2,
      seed: Math.random() * 5,
    }));
  }, []);
  useFrame((state) => {
    const p = phaseRef.current;
    const active = Math.min(1, Math.max(0, (p - 2.4) / 1.2));
    refs.current.forEach((r, i) => {
      if (!r) return;
      const m = marks[i];
      const t = (state.clock.elapsedTime * 0.22 + m.seed) % 1;
      const r_ = 1.35 + t * 1.6;
      const x = Math.cos(m.a) * r_;
      const z = Math.sin(m.a) * r_;
      r.position.set(x, 0, z);
      const mat = r.children[0].material;
      mat.opacity = (1 - t) * 0.85 * active;
      mat.color.set('#f87171');
      r.children[1].material.emissiveIntensity = (1 - t) * 1.4 * active;
    });
  });
  return (
    <group>
      {marks.map((_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh>
            <octahedronGeometry args={[0.14, 0]} />
            <meshBasicMaterial color="#f87171" transparent opacity={0} depthWrite={false} />
            <pointLight distance={2.4} intensity={4} color="#ef4444" />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color="#111720" emissive="#ef4444" emissiveIntensity={0} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Core({ phaseRef }) {
  const shell1 = useRef();
  const shell2 = useRef();
  const ring = useRef();
  const packets = useRef([]);
  const packetsOffset = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2), []);
  const glowA = useRef();
  const glowB = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = phaseRef.current;
    shell1.current.rotation.y = t * 0.22;
    shell1.current.rotation.x = Math.sin(t * 0.14) * 0.3;
    shell2.current.rotation.y = -t * 0.36;
    ring.current.rotation.z += state.delta * 0.6;
    const speeds = smooth(1, 0.55, Math.min(1, Math.max(0, (p - 3) / 1)));
    packets.current.forEach((r, i) => {
      const ang = packetsOffset[i] + t * 0.7 * speeds;
      r.position.set(Math.cos(ang) * 1.3, 0, Math.sin(ang) * 1.3);
      r.rotation.y += state.delta * 2;
    });
    const pulse = 1 + Math.sin(t * 1.4) * 0.05;
    glowA.current.scale.setScalar(pulse);
    glowB.current.scale.setScalar(1 + Math.sin(t * 1.1 + 1) * 0.06);
  });
  return (
    <group position={[0, 0.15, 0]}>
      <mesh ref={shell1}>
        <icosahedronGeometry args={[1.02, 1]} />
        <meshBasicMaterial color="#a8c6ee" wireframe transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh ref={shell2}>
        <octahedronGeometry args={[0.74, 0]} />
        <meshStandardMaterial color="#0b2036" metalness={0.85} roughness={0.2} transparent opacity={0.5} wireframe />
      </mesh>
      <mesh ref={ring}>
        <torusGeometry args={[0.92, 0.015, 8, 72]} />
        <meshBasicMaterial color="#7fd4ff" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={glowA}>
        <sphereGeometry args={[0.38, 20, 16]} />
        <meshBasicMaterial color="#d9ecff" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={glowB}>
        <sphereGeometry args={[0.62, 20, 16]} />
        <meshBasicMaterial color="#4b7fb8" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.21, 32, 24]} />
        <meshStandardMaterial color="#eaf5ff" emissive="#9fd4ff" emissiveIntensity={1.4} roughness={0.25} />
      </mesh>
      <pointLight intensity={16} distance={10} color="#93b6ef" />
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} ref={(el) => (packets.current[i] = el)}>
          <boxGeometry args={[0.17, 0.13, 0.13]} />
          <meshStandardMaterial color="#123a55" emissive="#38bdf8" emissiveIntensity={0.6} metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function ServiceNodes({ phaseRef }) {
  const refs = useRef([]);
  const linkGeo = useMemo(() => {
    const pts = [];
    SERVICES.forEach((s) => {
      const x = Math.cos(s.a) * 1.9;
      const z = Math.sin(s.a) * 1.9;
      pts.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z));
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.length * 3), 3));
    pts.forEach((v, i) => {
      g.attributes.position.array[i * 3] = v.x;
      g.attributes.position.array[i * 3 + 1] = v.y;
      g.attributes.position.array[i * 3 + 2] = v.z;
    });
    return g;
  }, []);
  const groupRef = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = phaseRef.current;
    const links = groupRef.current.children[0];
    if (links && links.material) links.material.opacity = 0.25 + Math.min(1, p) * 0.25;
    refs.current.forEach((r, i) => {
      if (!r) return;
      r.rotation.y += state.delta * 0.6;
      const alive = smooth(0.35, 1, Math.min(1, p));
      r.children[0].material.opacity = 0.9 * alive;
      const e = r.children[0].material;
      e.emissiveIntensity = e.emissiveIntensity * 0.94 + (0.9 + Math.sin(t * 1.6 + i * 2) * 0.2) * 0.06;
    });
  });
  return (
    <group ref={groupRef}>
      <lineSegments geometry={linkGeo}>
        <lineBasicMaterial color="#54b8e8" transparent opacity={0.3} depthWrite={false} />
      </lineSegments>
      <group>
        {SERVICES.map((s, i) => {
          const x = Math.cos(s.a) * 1.9;
          const z = Math.sin(s.a) * 1.9;
          return (
            <group key={s.label} position={[x, 0.15, z]}>
              <group ref={(el) => (refs.current[i] = el)}>
                <mesh>
                  <boxGeometry args={[0.44, 0.3, 0.3]} />
                  <meshStandardMaterial color="#10263e" emissive={s.color} emissiveIntensity={0.9} metalness={0.65} roughness={0.32} transparent opacity={0.9} />
                </mesh>
                <mesh position={[0, 0, 0.18]}>
                  <sphereGeometry args={[0.06, 10, 10]} />
                  <meshBasicMaterial color={s.color} />
                </mesh>
                <pointLight distance={3} intensity={8} color={s.color} />
              </group>
              <TechLabel position={[0, -0.52, 0]} color={s.color} size={8} opacity={0.72}>
                {s.label}
              </TechLabel>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function ExternalZone() {
  const ref = useRef();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints(makeCircle(4.3, 90));
    return g;
  }, []);
  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * -0.03;
  });
  return (
    <group>
      <lineLoop ref={ref} geometry={geo}>
        <lineBasicMaterial color="#7f6570" transparent opacity={0.22} depthWrite={false} />
      </lineLoop>
      {[
        { x: 4.0, z: 1.6, label: 'CLOUD' },
        { x: -3.2, z: -2.9, label: 'EXTERNAL API' },
        { x: -4.1, z: 0.4, label: 'PUBLIC LLM' },
      ].map((e, i) => (
        <group key={i} position={[e.x, 0.1, e.z]}>
          <mesh>
            <boxGeometry args={[0.34, 0.22, 0.22]} />
            <meshBasicMaterial color="#4a3040" transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <torusGeometry args={[0.1, 0.015, 6, 20]} />
            <meshBasicMaterial color="#b93f3f" transparent opacity={0.8} />
          </mesh>
          <TechLabel position={[0, -0.32, 0]} color="#b98a8a" size={7} opacity={0.5}>
            {e.label} · BLOCKED
          </TechLabel>
        </group>
      ))}
      <TechLabel position={[0, 2, 0]} color="#63748c" size={8} opacity={0.5}>
        EXTERNAL NETWORK · EGRESS DENY
      </TechLabel>
    </group>
  );
}

function RefineryHints() {
  const refs = useRef([]);
  const ringRef = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((r, i) => {
      if (r) r.rotation.z = 0.25 + Math.sin(t * 0.2 + i) * 0.06;
    });
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.02;
    }
  });
  const arcs = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 3; i++) {
      arr.push({
        r: 1.6 + i * 1.1,
        a0: -2.6,
        a1: 2.6,
        y: -1.35,
        x: (i % 2 === 0 ? 1 : -1) * (2.2 + i * 0.35),
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {arcs.map((arc, i) => {
        const pts = [];
        for (let a = arc.a0; a <= arc.a1; a += 0.08) {
          pts.push(new THREE.Vector3(arc.x + Math.cos(a) * arc.r, arc.y + Math.sin(a) * arc.r * 0.55, -1.2 + i * 0.6));
        }
        const g = new THREE.BufferGeometry();
        g.setFromPoints(pts);
        return (
          <group key={i} ref={(el) => (refs.current[i] = el)}>
            <line geometry={g}>
              <lineBasicMaterial color="#1d3a5b" transparent opacity={0.4} depthWrite={false} />
            </line>
            <mesh position={[arc.x + Math.cos(arc.a1) * arc.r, arc.y + Math.sin(arc.a1) * arc.r * 0.55, -1.2 + i * 0.6]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#2e5f88" transparent opacity={0.6} />
            </mesh>
          </group>
        );
      })}
      <group ref={ringRef} position={[-3.4, -1.1, -1.4]}>
        <mesh>
          <torusGeometry args={[0.85, 0.03, 6, 40]} />
          <meshStandardMaterial color="#102841" emissive="#1f4a6d" emissiveIntensity={0.5} metalness={0.6} roughness={0.4} transparent opacity={0.55} />
        </mesh>
      </group>
      <group position={[3.2, -1.05, -1.6]}>
        <mesh>
          <cylinderGeometry args={[0.18, 0.24, 1.1, 14]} />
          <meshStandardMaterial color="#0e2236" metalness={0.7} roughness={0.5} transparent opacity={0.6} />
        </mesh>
      </group>
      <TechLabel position={[0, -1.85, 0]} color="#28455f" size={7} opacity={0.45}>
        PLANT PROCESS NETWORK · ON-PREM
      </TechLabel>
    </group>
  );
}

function VectorRain({ phaseRef }) {
  const ref = useRef();
  const count = 60;
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.6 + Math.random() * 1.4;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 2.6;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame(() => {
    const p = phaseRef.current;
    const mat = ref.current.material;
    const active = Math.min(1, Math.max(0, (p - 1.5) / 1.2));
    mat.opacity = 0.5 * active;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.035} color="#7ac6f0" transparent opacity={0} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// Auth-mode shield: an identity/authorization marker that reacts to field
// focus — email raises the identity ring, password locks the security shield.
function AuthShield({ focusRef }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const f = focusRef.current;
    const target = 0.3 + f * 0.45;
    ref.current.children.forEach((m) => {
      if (m.material) {
        const op = m.material.opacity;
        m.material.opacity = op + (target - op) * 0.04;
      }
    });
    ref.current.rotation.z += state.delta * 0.3;
    ref.current.scale.setScalar(0.92 + Math.sin(t * (1.2 + f * 0.8)) * 0.035);
  });
  return (
    <group position={[0, 0.3, 0]}>
      <group ref={ref}>
        <mesh>
          <torusGeometry args={[1.35, 0.018, 6, 64]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh>
          <torusGeometry args={[1.5, 0.007, 6, 64]} />
          <meshBasicMaterial color="#7fd4ff" transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <TechLabel position={[0, 1.85, 0]} color="#34d399" size={8} opacity={0.8}>
        IDENTITY · LOCAL AUTH
      </TechLabel>
    </group>
  );
}

// Scroll narrative driver — the fixed background scene reads this ref and
// morphs between the five stages of the product story. In auth mode the scene
// holds the fully-sealed "sovereignty" state and reacts to form focus.
export default function SovereignCoreScene({ phase = 0, mode = 'hero' }) {
  const phaseRef = useRef(0);
  const focusRef = useRef(0);
  useFrame((state, delta) => {
    if (mode === 'auth') {
      phaseRef.current = Math.max(phaseRef.current, 4);
    } else {
      phaseRef.current = Math.max(0, phaseRef.current + (phase - phaseRef.current) * Math.min(delta * 1.4, 1));
    }
    if (mode === 'auth' && typeof document !== 'undefined') {
      const ae = document.activeElement;
      let f = 0;
      if (ae) {
        const tag = (ae.tagName || '').toLowerCase();
        if (tag === 'input') {
          f = String(ae.type || '').toLowerCase() === 'password' ? 2 : 1;
        }
      }
      focusRef.current += (f - focusRef.current) * Math.min(delta * 5, 1);
    }
  });
  return (
    <group position={[0, 0.2, 0]}>
      <color attach="background" args={['#030305']} />
      <ambientLight intensity={0.32} />
      <directionalLight position={[4, 6, 5]} intensity={0.5} color="#b9c8ff" />
      <directionalLight position={[-5, 4, -4]} intensity={0.28} color="#9dbce6" />
      <ParallaxGroup amount={0.05}>
        <Core phaseRef={phaseRef} />
        <ServiceNodes phaseRef={phaseRef} />
        <BoundaryRing />
        <BoundarySegments focusRef={mode === 'auth' ? focusRef : null} />
        <BlockedAttempts phaseRef={phaseRef} />
        <ExternalZone />
        <RefineryHints />
        <VectorRain phaseRef={phaseRef} />
        {mode === 'auth' && <AuthShield focusRef={focusRef} />}
      </ParallaxGroup>
      <TechLabel position={[3.05, -1.05, 0]} color="#5f86b8" size={8} opacity={0.55}>
        LOCAL AI ZONE
      </TechLabel>
    </group>
  );
}