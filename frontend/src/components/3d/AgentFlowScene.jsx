import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import TechLabel from './TechLabel';

// The agentic workflow: a governed multi-step pipeline. A data packet travels
// the chain and the active stage lights up — controlled, observable, approved.
const STAGES = [
  { label: 'USER', color: '#7dd3fc' },
  { label: 'SECURITY', color: '#fbbf24' },
  { label: 'CLASSIFIER', color: '#38bdf8' },
  { label: 'ROUTER', color: '#22d3ee' },
  { label: 'PLANNER', color: '#60a5fa' },
  { label: 'TOOLS · RAG', color: '#2dd4bf' },
  { label: 'VERIFY', color: '#34d399' },
  { label: 'APPROVAL', color: '#f59e0b' },
  { label: 'DELIVERABLE', color: '#34d399' },
];

function pathPoint(t) {
  const x = -6 + t * 12;
  const y = Math.sin(t * Math.PI * 4) * 1.7;
  return new THREE.Vector3(x, y, 0);
}

function buildPath() {
  const pts = [];
  for (let i = 0; i <= 120; i++) pts.push(pathPoint(i / 120));
  const g = new THREE.BufferGeometry();
  g.setFromPoints(pts);
  return g;
}

export default function AgentFlowScene() {
  const pathGeo = useMemo(() => buildPath(), []);
  const nodePts = useMemo(() => STAGES.map((_, i) => pathPoint((i + 0.5) / STAGES.length)), []);
  const packet = useRef();
  const nodeRefs = useRef([]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime * 0.16;
    const s = t % 1;
    const pos = pathPoint(s);
    if (packet.current) {
      packet.current.position.set(pos.x, pos.y, pos.z);
      const m = packet.current.material;
      m.opacity = 0.85 + Math.sin(s * Math.PI) * 0.15;
    }
    const idx = Math.min(STAGES.length - 1, Math.floor(s * STAGES.length));
    nodeRefs.current.forEach((r, i) => {
      if (!r || !r.userData.base) return;
      const target = i === idx ? 1 : 0.18;
      const mat = r.userData.base.material;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(delta * 5, 1);
      mat.opacity = i === idx ? 1 : 0.55;
    });
  });

  return (
    <group>
      <line geometry={pathGeo}>
        <lineBasicMaterial color="#1e4a6e" transparent opacity={0.55} depthWrite={false} />
      </line>
      {STAGES.map((s, i) => {
        const p = nodePts[i];
        return (
<group key={s.label} position={[p.x, p.y, 0]}>
            <group ref={(el) => {
              nodeRefs.current[i] = el;
              if (el) el.userData.base = el.children[0];
            }}>
              <mesh>
                <boxGeometry args={[0.46, 0.34, 0.34]} />
                <meshStandardMaterial color="#0e2033" emissive={s.color} emissiveIntensity={0.18} metalness={0.6} roughness={0.3} transparent opacity={0.55} />
              </mesh>
              <mesh>
                <torusGeometry args={[0.42, 0.02, 6, 32]} />
                <meshBasicMaterial color={s.color} transparent opacity={0.5} depthWrite={false} />
              </mesh>
            </group>
            <TechLabel position={[0, -0.5, 0]} color={s.color} size={7.5} opacity={0.7}>
              {s.label}
            </TechLabel>
        </group>
        );
      })}
      <mesh ref={packet}>
        <sphereGeometry args={[0.13, 14, 14]} />
        <meshBasicMaterial color="#7fd4ff" />
        <pointLight distance={2.8} intensity={6} color="#7fd4ff" />
      </mesh>
    </group>
  );
}