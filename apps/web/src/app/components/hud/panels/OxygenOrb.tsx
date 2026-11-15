import { createContext, type ReactNode, useContext, useId } from 'react';
import './oxygenOrb.css';

export interface MarsCycleTime {
  sol: number;
  hour?: number;
  formatted: string;
  isDay: boolean;
}

export const MarsCycleContext = createContext<MarsCycleTime>({
  sol: 1,
  hour: 9,
  formatted: '09:00',
  isDay: true,
});

function point(angle: number, radius = 96) {
  const radians = (angle * Math.PI) / 180;
  return { x: 130 + radius * Math.cos(radians), y: 132 + radius * Math.sin(radians) };
}

function arc(start: number, end: number) {
  const a = point(start);
  const b = point(end);
  return `M${a.x} ${a.y}A96 96 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/** Oxygen inside the glass sphere; the outer arc follows the existing Martian day cycle. */
export function OxygenOrb({
  level,
  title,
  status,
}: {
  level: number;
  title?: string;
  status?: ReactNode;
}) {
  const id = useId();
  const time = useContext(MarsCycleContext);
  const [hours = 9, minutes = 0] = time.formatted.split(':').map(Number);
  const rawHour = time.hour ?? hours + (minutes || 0) / 60;
  const hour = Number.isFinite(rawHour) ? ((rawHour % 24) + 24) % 24 : 9;
  const phase = ((hour - 6 + 24) % 24) / 24;
  const markerAngle = 135 + phase * 270;
  const amount = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 0;
  const state = amount < 25 ? 'critical' : amount < 50 ? 'warning' : 'normal';
  const fillY = 197 - (130 * amount) / 100;

  return (
    <section
      className="oxygen-orb"
      data-bit-target="day-cycle"
      data-level={state}
      title={title}
      aria-label="Oxigênio e ciclo do Sol"
    >
      <svg viewBox="0 0 260 264" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>
          Oxigênio: {Math.round(amount)}% · Sol {time.sol}
        </title>
        <desc id={`${id}-desc`}>
          Esfera preenchida conforme a reserva de oxigênio. Anel externo: ciclo de dia e noite,{' '}
          {time.isDay ? 'dia' : 'noite'} em Marte.
          {state === 'critical' ? ' Oxigênio crítico: retorne à base.' : ''}
        </desc>
        <defs>
          <clipPath id={`${id}-glass`}>
            <circle cx="130" cy="132" r="65" />
          </clipPath>
        </defs>
        <path d={arc(135, 405)} className="oxygen-orb__ring-outline" />
        <path d={arc(135, 270)} stroke="#dfac59" className="oxygen-orb__ring" />
        <path d={arc(270, 405)} stroke="#617d9b" className="oxygen-orb__ring" />
        {Array.from({ length: 25 }, (_, i) => {
          const angle = 135 + (i * 270) / 24;
          const a = point(angle, 88);
          const b = point(angle, i % 6 === 0 ? 103 : 98);
          return (
            <path
              key={angle}
              d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
              stroke="#1d3546"
              strokeWidth={i % 6 === 0 ? 2.5 : 1.3}
              opacity=".6"
            />
          );
        })}
        <g
          transform="translate(26 61)"
          fill="none"
          stroke="#ffe1a2"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <circle r="6" fill="#e9b75f" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <path key={angle} d="M0-10v-3" transform={`rotate(${angle})`} />
          ))}
        </g>
        <g transform="translate(231 55)">
          <circle r="11" fill="#b8cbd9" stroke="#203749" strokeWidth="2" />
          <circle cx="-4" cy="-3" r="3" fill="#7b95ad" />
          <circle cx="4" cy="3" r="2.5" fill="#7b95ad" />
          <circle cx="2" cy="-5" r="1.5" fill="#7b95ad" />
        </g>
        <g className="oxygen-orb__marker" transform={`translate(130 132) rotate(${markerAngle})`}>
          <path
            d="M91 0 110-9v18Z"
            fill={time.isDay ? '#ffe3a1' : '#d0e5f5'}
            stroke="#1d3546"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </g>
        <g data-bit-target="personal-oxygen">
        <circle cx="130" cy="132" r="68" fill="#789aab" stroke="#193547" strokeWidth="3" />
        <circle cx="130" cy="132" r="65" fill="#253f50" />
        <g clipPath={`url(#${id}-glass)`}>
          <rect
            className="oxygen-orb__fill"
            x="64"
            y={fillY}
            width="132"
            height={197 - fillY}
            fill="var(--oxygen-fill)"
          />
        </g>
        <circle cx="130" cy="132" r="65" fill="none" stroke="#224557" strokeWidth="2" />
        <text x="130" y="130" className="oxygen-orb__label">
          O₂
        </text>
        <text x="130" y="155" className="oxygen-orb__value">
          {Math.round(amount)}%
        </text>
        </g>
        <text x="130" y="231" className="oxygen-orb__sol">
          SOL {time.sol}
        </text>
      </svg>
      {status && <span className="oxygen-orb__status">{status}</span>}
    </section>
  );
}
