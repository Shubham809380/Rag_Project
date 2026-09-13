import { Html } from '@react-three/drei';

export default function TechLabel({ children, color = '#8fb3de', opacity = 0.8, position = [0, 0, 0], size = 9 }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          fontSize: size,
          fontFamily: "'Fira Code', monospace",
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          color,
          opacity,
          textShadow: '0 0 12px rgba(8,12,20,0.9), 0 1px 2px rgba(0,0,0,0.9)',
        }}
      >
        {children}
      </div>
    </Html>
  );
}