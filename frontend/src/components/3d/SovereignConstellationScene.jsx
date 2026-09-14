import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const PHASE_COLORS = ['#22d3ee', '#0ea5e9', '#38bdf8', '#f5b04f'];
const phaseColor = (p) => PHASE_COLORS[Math.min(PHASE_COLORS.length - 1, Math.max(0, Math.round(p)))];

const BG_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BG_FRAG = `
  precision highp float;
  uniform vec2 uRes;
  uniform float uAspect;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.55;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = uv - 0.5;
    p.x *= uAspect;
    p += uPointer * 0.28 + uPointer * vec2(p.y, -p.x) * 0.12;

    float t = uTime * 0.055;
    float n1 = fbm(p * 1.55 + vec2(t, -t * 0.7));
    float n2 = fbm(p * 3.1 - t * 0.85 + n1 * 1.25);
    float n3 = fbm(p * 6.5 + t * 0.5 + n2 * 0.8);

    vec3 col = mix(uColA, uColB, smoothstep(0.2, 0.9, n2 * 0.7 + n1 * 0.5));
    col *= 0.55 + 0.5 * n3;
    col += uColB * 0.08 * sin((p.y * 7.0 + n2 * 2.5) * 3.14159 + t * 1.8);

    float hrz = 0.5;
    if (uv.y < hrz) {
      float g = (hrz - uv.y) / hrz;
      float depth = g * 7.0 + uTime * 0.9;
      float xs = uv.x * uAspect;
      float gx = abs(fract(xs * 7.0) - 0.5);
      float gz = abs(fract(depth) - 0.5);
      float lineX = smoothstep(0.44, 0.5, gx);
      float lineZ = smoothstep(0.44, 0.5, gz);
      float fade = exp(-g * 2.6) * smoothstep(0.0, 0.06, g);
      col += uColB * (lineX * 0.42 + lineZ * 0.42) * fade;
    }

    float d = length(p * vec2(0.8, 1.0));
    float vg = smoothstep(0.92, 0.12, d);
    col *= 0.32 + 0.68 * vg;
    col *= 0.42 + 0.58 * smoothstep(-2.0, 1.2, p.y);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function buildStars() {
  const n = 220;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    pos[i * 3 + 2] = -0.6 - Math.random() * 1.2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

export default function SovereignAuroraScene({ phase = 4 }) {
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const size = useThree((s) => s.size);
  const viewport = useThree((s) => s.viewport);

  const currA = useMemo(() => new THREE.Color('#0a1826'), []);
  const currB = useMemo(() => new THREE.Color('#1e749e'), []);

  const planeRef = useRef();
  const starsRef = useRef();
  const starMatRef = useRef();
  const uniforms = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uAspect: { value: 1.6 },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uColA: { value: new THREE.Color('#0a1826') },
      uColB: { value: new THREE.Color('#1e749e') },
    }),
    [],
  );

  const stars = useMemo(() => buildStars(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const p = phaseRef.current;
    const target = phaseColor(p);

    uniforms.uTime.value = t;
    uniforms.uRes.value.set(size.width, size.height);
    uniforms.uAspect.value = viewport.aspect;

    currA.set('#0a1826');
    currB.set(target);
    uniforms.uColA.value.lerp(currA, Math.min(delta * 2, 1));
    uniforms.uColB.value.lerp(currB, Math.min(delta * 2, 1));

    const px = state.pointer.x;
    const py = state.pointer.y;
    uniforms.uPointer.value.lerp(new THREE.Vector2(px, py), Math.min(delta * 2.4, 1));

    if (planeRef.current) {
      const r = planeRef.current.rotation;
      r.y += (-px * 0.03 - r.y) * Math.min(delta * 1.6, 1);
      r.x += (py * 0.022 - r.x) * Math.min(delta * 1.6, 1);
    }

    if (starMatRef.current) {
      starMatRef.current.opacity = 0.5 + 0.28 * Math.sin(t * 0.5);
      starMatRef.current.color.copy(currB);
    }
    if (starsRef.current) starsRef.current.rotation.z = t * 0.004;
  });

  return (
    <group>
      <mesh ref={planeRef} position={[0, 0.4, 0]} scale={[24, 24, 1]} frustumCulled={false} renderOrder={-2}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={BG_VERT}
          fragmentShader={BG_FRAG}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <points ref={starsRef} geometry={stars} renderOrder={-1}>
        <pointsMaterial
          ref={starMatRef}
          color="#7dd3fc"
          size={0.05}
          sizeAttenuation
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}