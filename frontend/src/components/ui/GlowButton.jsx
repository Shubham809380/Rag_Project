import { Link } from 'react-router-dom';

export default function GlowButton({
  to,
  variant = 'primary',
  children,
  className = '',
  disabled,
  small = false,
  onClick,
  ...rest
}) {
  const cls = small ? `${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} !px-4 !py-2 !text-[12px] ${className}` : `${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}