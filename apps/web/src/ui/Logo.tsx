import { Link } from 'react-router';

/** Marca: logotipo oficial Mars Outpost */
export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <img
      src="/assets/branding/mars-outpost-logo.svg"
      alt="Mars Outpost"
      width={size}
      height={size}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="logo" aria-label="Mars Outpost — início">
      <LogoMark size={compact ? 34 : 44} />
      {!compact && (
        <img
          src="/assets/branding/mars-outpost-wordmark.svg"
          alt="Mars Outpost"
          style={{ height: 26, width: 'auto', display: 'block', objectFit: 'contain' }}
        />
      )}
    </Link>
  );
}
