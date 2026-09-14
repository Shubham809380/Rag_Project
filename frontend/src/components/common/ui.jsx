export function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-xl border bg-card p-5 ${className}`}
      style={{ borderColor: 'var(--border-default)', boxShadow: 'var(--shadow-sm)' }} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{title}</h1>
        {subtitle && <p className="text-sm text-fg-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(59,130,246,0.1)' }}>
          <Icon size={26} style={{ color: '#3B82F6' }} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-heading mb-1">{title}</h3>
      {description && <p className="text-sm text-fg-muted max-w-md mb-5">{description}</p>}
      {action}
    </div>
  );
}

export function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex items-center gap-3 text-fg-muted">
        <span className="inline-block w-[22px] h-[22px] rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: '#3B82F6' }} />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export function Badge({ children, color = '#3B82F6', bg }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
      style={{ color, background: bg || `${color}1a` }}>
      {children}
    </span>
  );
}

export function Spinner({ size = 20, color = '#3B82F6' }) {
  return (
    <span className="inline-block rounded-full border-2 animate-spin"
      style={{ width: size, height: size, borderColor: 'var(--border-strong)', borderTopColor: color }} />
  );
}

export function TextArea({ ...props }) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border bg-input px-4 py-3 text-sm text-fg placeholder:text-fg-muted focus-ring outline-none transition-colors ${props.className || ''}`}
      style={{ borderColor: 'var(--border-default)' }}
    />
  );
}

export function TextInput({ ...props }) {
  return (
    <input
      {...props}
      className={`flex-1 min-w-0 rounded-xl border bg-input px-4 py-2.5 text-sm text-fg placeholder:text-fg-muted focus-ring outline-none transition-colors ${props.className || ''}`}
      style={{ borderColor: 'var(--border-default)' }}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className={`rounded-xl border bg-input px-3 py-2.5 text-sm text-fg focus-ring outline-none appearance-none ${props.className || ''}`}
      style={{ borderColor: 'var(--border-default)' }}
    >
      {children}
    </select>
  );
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-ring ${className}`}
      style={{ background: 'linear-gradient(135deg, #3B82F6, #22D3EE)', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-fg-secondary hover:bg-card-hover focus-ring transition-colors ${className}`}
      style={{ border: '1px solid var(--border-default)' }}
    >
      {children}
    </button>
  );
}
