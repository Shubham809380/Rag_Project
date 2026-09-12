import { useRef, useEffect } from 'react';

function handleTilt(e, el, max = 7) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
}

function resetTilt(el) {
  if (el) el.style.transform = '';
}

export default function GlassCard({ children, className = '', tilt = false, as: Tag = 'div', ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (tilt && el) {
      const move = (e) => handleTilt(e, el);
      const leave = () => resetTilt(el);
      el.addEventListener('mousemove', move);
      el.addEventListener('mouseleave', leave);
      return () => {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
      };
    }
  }, [tilt]);

  return (
    <Tag
      ref={ref}
      className={`glass-panel ${className}`}
      style={{ transition: 'transform 0.18s ease, box-shadow 0.18s ease', transformStyle: 'preserve-3d', willChange: tilt ? 'transform' : undefined }}
      {...rest}
    >
      {children}
    </Tag>
  );
}