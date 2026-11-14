import { useId } from 'react';
import { useSolarCleaning } from './useSolarCleaning';

const PARTICLES = Array.from({ length: 24 }, (_, id) => ({
  id: `dust-${id}`,
  radius: 1.5 + (id % 3),
}));

/** Vector equipment with a persistent erasable dust bitmap. */
export function SolarPanelIllustration({ onComplete }: { onComplete: () => void }) {
  const controls = useSolarCleaning(onComplete);
  const id = useId();
  const ref = (name: string) => `url(#${id}-${name})`;

  return (
    <svg
      ref={controls.svg}
      className="solar-panel-art"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: The drawing surface supports arrow keys and Space.
      tabIndex={0}
      aria-describedby={`${id}-instructions`}
      viewBox="80 70 800 550"
      role="application"
      aria-roledescription="minigame de limpeza"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>Painel solar com poeira marciana e uma escova</title>
      <desc id={`${id}-desc`}>
        Células azuis brilham à esquerda de um painel inclinado. Poeira alaranjada cobre o restante
        da superfície. Uma escova de cerdas claras repousa sobre a borda.
      </desc>
      <desc id={`${id}-instructions`}>
        Segure o botão do mouse ou arraste o dedo para limpar com a escova. No teclado, mova a
        escova com as setas e segure Espaço para limpar.
      </desc>
      <defs>
        <linearGradient id={`${id}-cell`} x2="0.7" y2="1">
          <stop stopColor="#388ebf" />
          <stop offset="0.5" stopColor="#20548a" />
          <stop offset="1" stopColor="#13315d" />
        </linearGradient>
        <linearGradient id={`${id}-frame`} x2="0.2" y2="1">
          <stop stopColor="#f0e7cf" />
          <stop offset="0.5" stopColor="#9aa5a5" />
          <stop offset="1" stopColor="#d1d4c5" />
        </linearGradient>
        <pattern
          id={`${id}-grid`}
          width="65"
          height="66"
          patternUnits="userSpaceOnUse"
          x="146"
          y="142"
        >
          <rect width="62" height="63" rx="5" fill={ref('cell')} />
          <path d="M4 16H58M4 32H58M4 48H58" stroke="#8abbd3" strokeOpacity=".3" />
          <path d="M16 3V60M46 3V60" stroke="#8abbd3" strokeOpacity=".5" />
          <path d="M4 5H58" stroke="#abdfe9" strokeOpacity=".6" />
        </pattern>
        <clipPath id={`${id}-surface`}>
          <rect x="146" y="142" width="650" height="396" rx="6" />
        </clipPath>
      </defs>

      {/* Equipment feet and a cable disappearing into the base. */}
      <ellipse cx="479" cy="555" rx="358" ry="50" fill="#703f36" opacity=".3" />
      <path d="M681 511C734 603 889 510 982 591" fill="none" stroke="#733f35" strokeWidth="15" />
      <path d="M681 508C734 600 889 507 982 588" fill="none" stroke="#293b4a" strokeWidth="9" />
      <path
        d="m315 474-16 111 59 8 24-125M617 445l25 105 58-8-18-108"
        fill="#52606a"
        stroke="#34414d"
        strokeWidth="6"
      />
      <path d="m281 580 87 7 16 14-104-5ZM625 549l89-12 13 12-101 16Z" fill="#c4c8bc" />
      <g ref={controls.panel} className="solar-panel-surface" transform="rotate(-9 470 340)">
        <rect
          x="123"
          y="125"
          width="696"
          height="442"
          rx="16"
          fill="#3a4856"
          stroke="#2d394b"
          strokeWidth="5"
        />
        <rect
          x="123"
          y="116"
          width="696"
          height="442"
          rx="14"
          fill={ref('frame')}
          stroke="#e7e2cb"
          strokeWidth="3"
        />
        <rect
          x="139"
          y="135"
          width="664"
          height="410"
          rx="8"
          fill="#122a42"
          stroke="#5b7079"
          strokeWidth="3"
        />
        <g clipPath={ref('surface')}>
          <rect x="146" y="142" width="650" height="396" fill={ref('grid')} />
          <path
            d="m142 323 254-181h89L146 388ZM238 538l478-396h33L269 538Z"
            fill="#94d7ec"
            opacity=".1"
          />
          <foreignObject x="146" y="142" width="650" height="396" className="solar-dust-layer">
            <canvas ref={controls.dust} className="solar-dust" />
          </foreignObject>
          <g ref={controls.particles} className="solar-dust-particles">
            {PARTICLES.map(({ id, radius }) => (
              <circle key={id} r={radius} fill="#f4ca99" opacity="0" />
            ))}
          </g>
          <path d="m194 193 7 11 12 1-10 8 3 13-12-7-11 7 2-13-10-8 13-1Z" fill="#d9f8ff" />
          <path d="m318 349 3 7 8 2-7 4-1 8-5-6-8 1 4-7-3-7Z" fill="#c2eeff" />
        </g>
        {(
          [
            [134, 128],
            [807, 128],
            [134, 547],
            [807, 547],
          ] as const
        ).map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="4" fill="#526573" />
            <path d={`M${x - 2} ${y + 2}l4-4`} stroke="#cfd3c9" strokeWidth="1.5" />
          </g>
        ))}
        <rect x="574" y="540" width="114" height="14" rx="2" fill="#3a4956" />
        <text
          x="631"
          y="550"
          textAnchor="middle"
          fill="#e2dfce"
          fontSize="8"
          fontFamily="monospace"
          letterSpacing="2"
        >
          MO / SOLAR 01
        </text>
        <g
          ref={controls.brush}
          className="solar-brush"
          transform="translate(660 470) rotate(20) scale(.65) translate(0 -105)"
        >
          <ellipse cx="7" cy="112" rx="94" ry="26" fill="#4a342d" opacity=".2" />
          <path
            d="m-65 75-8 46q70 18 143 0l-10-46Z"
            fill="#d9b586"
            stroke="#ab835d"
            strokeWidth="3"
          />
          <path
            d="M-61 87l-4 32m16-31-2 33m15-32-1 34m14-33v35m14-34 1 35m13-35 2 35m12-35 3 34m11-35 5 34m10-35 6 32m8-33 8 31"
            stroke="#f8dfb0"
            strokeWidth="4"
          />
          <rect
            x="-75"
            y="54"
            width="143"
            height="38"
            rx="12"
            fill="#df9d52"
            stroke="#805536"
            strokeWidth="3"
          />
          <path d="M-61 61H54" stroke="#f3c17d" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M-22 54V-53Q-22-72-5-72H4q17 0 17 19V54Z"
            fill="#244b59"
            stroke="#193646"
            strokeWidth="4"
          />
          <path d="M-11-49V20" stroke="#4b7780" strokeWidth="6" strokeLinecap="round" />
          <path d="M-22 20H21V39H-22Z" fill="#ffbc4d" />
          <circle cx="0" cy="-53" r="5" fill="#acb4a8" />
        </g>
      </g>
      <g className="solar-scene-rocks" fill="#98553e">
        <path d="m70 556 17-14 24 6 8 15-38 3Z" />
        <path d="m830 629 19-19 28 5 10 21Z" />
        <path d="m167 642 12-9 17 3 4 11Z" />
      </g>
      <g className="solar-scene-rocks" fill="#edb17a">
        <path d="m70 556 17-14 24 6-16 6Z" />
        <path d="m830 629 19-19 28 5-24 9Z" />
      </g>
    </svg>
  );
}
