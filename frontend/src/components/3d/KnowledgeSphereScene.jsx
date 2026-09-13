import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import TechLabel from './TechLabel';

// Local knowledge / RAG: documents enter a vector sphere, a search pulse
// sweeps out from the center, and the closest chunks light up in response.
const SPHERE_R = 1.55;

function buildVectorCloud(count) {
  const pos = [];
  const pts = [];
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = SPHERE_R * Math.cbrt(0.3 + Math.random() * 0.7);
    pos.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
    pts.push(new THREE.Vector3(pos[pos.length - 3], pos[pos.length - 2], pos[pos.length - 1]));
  }
  const links = [];
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      if (pts[i].distanceTo(pts[j]) < 0.72) {
        links.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const l = new THREE.BufferGeometry();
  l.setAttribute('position', new THREE.BufferAttribute(new Float32Array(links), 3));
  return { g, l };
}

function DocPacket({ from, color }) {
  const ref = useRef();
  const t = useRef(Math.random());
  useFrame((state) => {
    t.current += state.delta * 0.12;
    const prog = t.current % 1;
    const x = from.x + (0 - from.x) * prog;
    const y = from.y + (0 - from.y) * prog;
    const z = from.z * (1 - prog);
    ref.current.position.set(x, y, z);
    ref.current.rotation.y += state.delta * 1.2;
    const m = ref.current.material;
    m.opacity = 0.25 + (1 - Math.abs(prog - 0.5) * 2) * 0.6;
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.24, 0.16, 0.05]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.4} />
    </mesh>
  );
}

export default function KnowledgeSphereScene() {
  const group = useRef();
  const pulse = useRef();
  const pulsePhase = useRef(1.4);
  const nodeRefs = useRef([]);
  const { g, l } = useMemo(() => buildVectorCloud(150), []);
  const docSources = useMemo(() => [
    { from: new THREE.Vector3(-4, 1.2, 1), color: '#38bdf8' },
    { from: new THREE.Vector3(-3.6, 0.4, -0.8), color: '#34d399' },
    { from: new THREE.Vector3(-4.2, -0.6, 0.5), color: '#22d3ee' },
  ], []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.08;
    pulsePhase.current -= delta * 0.5;
    if (pulsePhase.current <= 0) pulsePhase.current = 3.4;
    const a = pulsePhase.current;
    const pr = a * 2.2;
    pulse.current.scale.setScalar(pr);
    const m = pulse.current.material;
    m.opacity = Math.max(0, 0.5 - a * 0.3);
    const waveAngle = a * 15;
    nodeRefs.current.forEach((r, i) => {
      if (!r) return;
      const q = Math.abs(Math.sin(waveAngle + i * 0.6)) * (1 - a * 0.25);
      const em = r.material;
      const target = q > 0.75 ? 1.6 : 0.25;
      em.emissiveIntensity += (target - em.emissiveIntensity) * Math.min(delta * 4, 1);
    });
  });

  return (
    <group>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[SPHERE_R, 24, 18]} />
          <meshBasicMaterial color="#0a1426" wireframe transparent opacity={0.5} depthWrite={false} />
        </mesh>
        <lineSegments geometry={l}>
          <lineBasicMaterial color="#1d5a86" transparent opacity={0.3} depthWrite={false} />
        </lineSegments>
        <points geometry={g}>
          <pointsMaterial size={0.05} color="#7fd4ff" transparent opacity={0.85} sizeAttenuation depthWrite={false} />
        </points>
      </group>
      <group>
        {Array.from({ length: 150 }).map((_, i) => {
          const u = Math.random();
          const v = Math.random();
          const theta = 2 * Math.PI * u;
          const phi = Math.acos(2 * v - 1);
          const r = SPHERE_R * Math.cbrt(0.3 + Math.random() * 0.7);
          const x = r * Math.sin(phi) * Math.cos(theta);
          const y = r * Math.cos(phi);
          const z = r * Math.sin(phi) * Math.sin(theta);
          return (
            <mesh key={i} position={[x, y, z]} ref={(el) => {
              if (el) nodeRefs.current[i] = el;
            }}>
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshStandardMaterial color="#0d2b44" emissive="#38bdf8" emissiveIntensity={0.25} roughness={0.4} />
            </mesh>
          );
        })}
      </group>
      <mesh ref={pulse}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color="#7fd4ff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {docSources.map((d, i) => (
        <DocPacket key={i} from={d.from} color={d.color} />
      ))}
      <TechLabel position={[0, 2.1, 0]} color="#38bdf8" size={9} opacity={0.85}>
        LOCAL KNOWLEDGE · VECTOR INDEX
      </TechLabel>
      <TechLabel position={[-3.2, -1.9, 0]} color="#2e5f88" size={7.5} opacity={0.6}>
        DOCS · OCR → CHUNK → EMBED
      </TechLabel>
      <TechLabel position={[3.0, 1.9, 0]} color="#2e5f88" size={7.5} opacity={0.6}>
        SEARCH PULSE · RETRIEVE
      </TechLabel>
    </group>
  );
}