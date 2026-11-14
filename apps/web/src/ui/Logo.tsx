import { Link } from 'react-router';

/** Marca: planeta com anel e horizonte (sem logotipos de terceiros). */
export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lm-p" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb066" />
          <stop offset="0.55" stopColor="#f07a2a" />
          <stop offset="1" stopColor="#a8400f" />
        </linearGradient>
      </defs>
      <ellipse
        cx="32"
        cy="34"
        rx="30"
        ry="8.5"
        fill="none"
        stroke="#f07a2a"
        strokeWidth="3.2"
        transform="rotate(-18 32 34)"
        opacity="0.55"
      />
      <circle cx="32" cy="32" r="19" fill="url(#lm-p)" />
      <path
        d="M14 38 L22 33 L27 36 L33 30 L40 35 L46 32 L50 37 A19 19 0 0 1 14 38 Z"
        fill="#7a2c0c"
      />
    </svg>
  );
}

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="logo" aria-label="Mars Outpost — início">
      <LogoMark size={compact ? 34 : 42} />
      {!compact && (
        <span className="logo__word">
          <span>Mars</span>
          <span>Outpost</span>
        </span>
      )}
    </Link>
  );
}
