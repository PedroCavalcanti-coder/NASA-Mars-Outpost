/** Horizonte marciano em SVG (dunas em camadas + estrelas): arte própria, sem imagens externas. */
export function MarsScene({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 400"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="dune-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a4220" />
          <stop offset="1" stopColor="#5a2a14" />
        </linearGradient>
        <linearGradient id="dune-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a3017" />
          <stop offset="1" stopColor="#3c1b0d" />
        </linearGradient>
        <linearGradient id="dune-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#47200f" />
          <stop offset="1" stopColor="#1f0e07" />
        </linearGradient>
      </defs>
      <g fill="#ffe7d2" opacity=".7">
        <circle cx="140" cy="40" r="1.6" />
        <circle cx="330" cy="90" r="1.2" />
        <circle cx="520" cy="30" r="1.8" />
        <circle cx="760" cy="70" r="1.2" />
        <circle cx="980" cy="26" r="1.6" />
        <circle cx="1210" cy="84" r="1.3" />
        <circle cx="1360" cy="38" r="1.8" />
      </g>
      <path d="M0 250 Q220 190 460 235 T920 220 T1440 245 V400 H0Z" fill="url(#dune-a)" />
      <path d="M0 300 Q300 245 620 290 T1180 280 T1440 300 V400 H0Z" fill="url(#dune-b)" />
      {/* base: domo + painel solar + antena */}
      <g transform="translate(980 232)">
        <path d="M0 42 A46 46 0 0 1 92 42Z" fill="#e8d9cc" />
        <path
          d="M0 42 A46 46 0 0 1 92 42"
          fill="none"
          stroke="#fff3e8"
          strokeWidth="2"
          opacity=".6"
        />
        <rect x="38" y="22" width="16" height="20" rx="3" fill="#6a3017" />
        <path d="M108 42 L150 42 L138 24 L96 24Z" fill="#274a6b" />
        <path
          d="M-30 42 V8 M-30 8 l-9 -8 M-30 8 l9 -8"
          stroke="#e8d9cc"
          strokeWidth="3"
          fill="none"
        />
        <circle cx="-30" cy="6" r="3" fill="#ff9b45" />
      </g>
      <path d="M0 345 Q260 300 560 335 T1100 325 T1440 345 V400 H0Z" fill="url(#dune-c)" />
    </svg>
  );
}
