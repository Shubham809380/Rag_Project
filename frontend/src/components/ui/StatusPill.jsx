export default function StatusPill({ tone = '#22d3ee', children, mono = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${mono ? 'font-mono' : ''}`}
      style={{ background: `${tone}1f`, color: tone, border: `1px solid ${tone}38` }}
    >
      <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: tone, color: tone }} />
      {children}
    </span>
  );
}