import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

function cls({ variant = 'subtle', size = 'md', block, className }: CommonProps) {
  return [
    'btn',
    `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant,
  size,
  block,
  icon,
  loading,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cls({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner spinner--sm" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant,
  size,
  block,
  icon,
  className,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link to={to} className={cls({ variant, size, block, className })}>
      {icon}
      {children}
    </Link>
  );
}
