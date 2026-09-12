export default function SectionHeader({ eyebrow, title, subtitle, align = 'center' }) {
  const alignCls = align === 'center' ? 'text-center items-center' : 'text-left items-start';
  return (
    <div className={`flex flex-col ${alignCls} mb-10`}>
      {eyebrow && <span className="section-tag">{eyebrow}</span>}
      <h2 className="mt-3 text-2xl md:text-[30px] font-bold tracking-tight leading-tight" style={{ color: 'var(--text-heading)' }}>
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-[13.5px] max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      )}
      <div className="tech-divider w-24 mt-5" />
    </div>
  );
}