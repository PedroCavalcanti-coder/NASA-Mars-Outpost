import { type ReactNode, useId, useSyncExternalStore } from 'react';
import type { RepairAction, RepairState } from './repairState';

const portraitQuery = '(max-aspect-ratio: 4/5)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(portraitQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

function Wheel({ x, y, radius = 58 }: { x: number; y: number; radius?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={radius} fill="#263533" stroke="#192b2d" strokeWidth="10" />
      <circle r={radius - 14} fill="none" stroke="#5d6960" strokeWidth="10" strokeDasharray="5 9" />
      <circle r={radius * 0.44} fill="#a4afa1" stroke="#1e3638" strokeWidth="7" />
      <circle r={radius * 0.16} fill="#415754" />
    </g>
  );
}

function Part({
  label,
  enabled,
  onActivate,
  children,
  ...props
}: {
  label: string;
  enabled: boolean;
  onActivate: () => void;
  children: ReactNode;
  transform?: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG geometry needs keyboard-accessible group controls.
    <g
      {...props}
      role="button"
      aria-label={label}
      aria-disabled={!enabled}
      tabIndex={enabled ? 0 : -1}
      className="rover-repair-part"
      data-active={enabled}
      onClick={() => {
        if (enabled) onActivate();
      }}
      onKeyDown={(event) => {
        if (enabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onActivate();
        }
      }}
    >
      {children}
    </g>
  );
}

export function RoverRepairIllustration({
  state,
  dispatch,
  activeBolt,
}: {
  activeBolt: number | null;
  state: RepairState;
  dispatch: (action: RepairAction) => void;
}) {
  const removed = ['replacement', 'install'].includes(state.phase);
  const repaired = ['tighten', 'complete'].includes(state.phase);
  const id = useId().replace(/:/g, '');
  const portrait = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(portraitQuery).matches,
    () => false,
  );
  return (
    <svg
      className="rover-repair-art"
      viewBox={portrait ? '140 0 820 900' : '0 0 1100 820'}
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
    >
      <title id={`${id}-title`}>Reparo do rover</title>
      <desc id={`${id}-description`}>
        Inspecione a roda e substitua a peça danificada. Rover elevado em um macaco na oficina
        marciana. O rover tem cabine clara angular, janelas escuras, faixa vermelha e seis rodas. A
        roda dianteira tem uma fissura no cubo e um parafuso solto. Uma chave, parafusos novos e um
        cubo de reposição estão na bancada. Pegue a chave, solte os parafusos e substitua o cubo
        para reparar a roda.
      </desc>
      {/* The open maintenance bay frames the Martian landscape. */}
      <path d="M-100-40H1200V900H-100Z" fill="#394e49" />
      <path d="M-30 22H1130V410H-30Z" fill="#d6aa80" />
      <path
        d="M-30 262 100 190 210 221 365 145 480 196 605 170 780 240 925 175 1140 260V455H-30Z"
        fill="#bf7d59"
      />
      <path
        d="m-30 340 140-74 100 26 92-40 95 53 160-45 120 42 152-13 98-29 213 64v147H-30Z"
        fill="#a66a50"
      />
      <path d="M-50 394Q430 350 1150 401V950H-50Z" fill="#a57253" />
      <path d="M-30 0H1140V42H-30ZM40 0H73V402H40ZM1025 0H1060V402H1025Z" fill="#2d423e" />
      <path d="M-10 53H1120M85 397H1005" stroke="#e6cba5" strokeWidth="4" opacity=".25" />
      {/* Orthographic side elevation: no roof plane or far-side wheels. */}
      <g>
        <path d="M220 280H815V309H220Z" fill="#272d29" />
        <path
          d="M280 324H750M300 305l30 40h170l40-40h160"
          fill="none"
          stroke="#706d5d"
          strokeWidth="13"
        />
        <path
          d="M220 155 248 115H739L812 222V279H220Z"
          fill="#ddd6bd"
          stroke="#4c5146"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M248 115H739L748 130H239Z" fill="#f0e8d4" />
        <path d="M425 166h76v54h-76Zm104 0h91v54h-91ZM648 151h67l41 69H648Z" fill="#202724" />
        <path d="M220 255H812V265H220Z" fill="#b74331" />
        <path d="M213 280H823V296H213Z" fill="#a8a18b" />
        <path d="M230 285H812" stroke="#e0d7be" strokeWidth="4" />
        <g transform="translate(335 211)">
          <ellipse rx="35" ry="27" fill="#254b7e" />
          <ellipse
            rx="32"
            ry="11"
            transform="rotate(-25)"
            fill="none"
            stroke="#eee9dd"
            strokeWidth="1.5"
          />
          <path d="m-38 24 66-48-33 34 28-12" fill="none" stroke="#c84938" strokeWidth="4" />
          <text
            textAnchor="middle"
            y="5"
            fill="#f4f0e5"
            fontSize="15"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
          >
            NASA
          </text>
        </g>
        <path d="M350 115V50" stroke="#4b4c43" strokeWidth="7" />
        <rect x="334" y="37" width="32" height="16" rx="2" fill="#ede4cf" />
        <rect x="410" y="102" width="100" height="13" fill="#5c5b50" />
        <rect x="661" y="98" width="28" height="17" rx="3" fill="#fff1c5" />
        <rect x="783" y="239" width="22" height="12" fill="#fff0b6" />
        <Wheel x={305} y={345} radius={57} />
        <Wheel x={520} y={345} radius={57} />
        {/* Exposed axle remains visible until the repaired wheel arrives. */}
        <circle cx="750" cy="345" r="27" fill="#7c8274" stroke="#263b35" strokeWidth="7" />
        <circle cx="750" cy="345" r="10" fill="#c6ccb8" />
        <path d="m727 380-28 75h104l-30-75Z" fill="#b56c44" stroke="#573f32" strokeWidth="6" />
        <path d="M750 375v55m-37 12h74" stroke="#e1b681" strokeWidth="7" />
      </g>

      {/* Foreground wheel, its damaged hub and exposed fixings. */}
      <g className="rover-repair-wheel" data-mounting={state.phase === 'complete'}>
        <circle r="177" fill="#34433b" stroke="#203734" strokeWidth="10" />
        {Array.from({ length: 28 }, (_, i) => i).map((i) => (
          <path
            key={i}
            d="m-12-162 20 10 12-1"
            transform={`rotate(${i * (360 / 28)})`}
            fill="none"
            stroke="#758172"
            strokeWidth="10"
            strokeLinecap="round"
          />
        ))}
        <circle r="134" fill="#253e3a" stroke="#8c9988" strokeWidth="7" />
        <circle r="116" fill="#a6b6a5" stroke="#1e3836" strokeWidth="8" />
        {Array.from({ length: 6 }, (_, i) => i).map((i) => (
          <g key={i} transform={`rotate(${i * 60})`}>
            <path
              d="m-20-98 40 0-8 39h-24Z"
              fill="#425e57"
              stroke="#7a9081"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path d="M-7-92H9" stroke="#233f3b" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
        <Part
          label={removed ? 'Encaixar cubo novo' : 'Retirar cubo danificado'}
          enabled={state.phase === 'remove' || state.phase === 'install'}
          onActivate={() => dispatch({ type: 'hub' })}
        >
          <circle
            r="63"
            fill={removed ? '#233b37' : repaired ? '#b9cbb6' : '#cfb38a'}
            stroke="#536f64"
            strokeWidth="8"
          />
          <circle
            r="46"
            fill={removed ? '#182e2b' : repaired ? '#719581' : '#8e9a83'}
            stroke="#dbcc9f"
            strokeWidth="5"
          />
          {removed ? (
            <path d="m0-24 21 12v24L0 24-21 12v-24Z" fill="#536f64" />
          ) : (
            !repaired && (
              <path
                d="m-8-43 15 21-13 15 17 15-8 17 14 22"
                fill="none"
                stroke="#594b39"
                strokeWidth="9"
                strokeLinejoin="round"
              />
            )
          )}
        </Part>
        {[30, 150, 270].map((angle, index) => (
          <Part
            key={angle}
            label={`${state.phase === 'tighten' ? 'Apertar' : 'Soltar'} parafuso ${index + 1}`}
            enabled={
              (state.phase === 'unbolt' || state.phase === 'tighten') &&
              !state.bolts.includes(index)
            }
            onActivate={() => dispatch({ type: 'bolt', index })}
            transform={`rotate(${angle}) translate(0 -78)`}
          >
            <circle r="31" fill="transparent" />
            <g
              opacity={
                (state.phase === 'unbolt' && state.bolts.includes(index)) ||
                ['remove', 'replacement', 'install'].includes(state.phase)
                  ? 0.18
                  : 1
              }
            >
              <path
                d="m-10-6 10-6 10 6v12l-10 6-10-6Z"
                fill="#e2dbb8"
                stroke="#506b62"
                strokeWidth="3"
              />
              <path d="M-5 0H5" stroke="#60766a" strokeWidth="3" />
            </g>
          </Part>
        ))}
        {activeBolt !== null && (
          <g
            transform={`rotate(${[30, 150, 270][activeBolt]}) translate(0 -78)`}
            pointerEvents="none"
          >
            <g className="rover-repair-wrench" data-tightening={state.phase === 'tighten'}>
              <path
                d="m-16-13-7-18 12-13v19h22v-19l12 13-7 18-7 10v106a9 9 0 0 1-18 0V-3Z"
                fill="#c2ccbc"
                stroke="#253d36"
                strokeWidth="4"
              />
              <path d="M0 20v65" stroke="#8b9c8c" strokeWidth="4" />
            </g>
          </g>
        )}
        <g opacity={repaired ? 0 : 1} transform="translate(70 40) rotate(32)">
          <path d="M0-8v29" stroke="#61796d" strokeWidth="12" />
          <path
            d="m-11-13 11-6 11 6v12L0 5-11-1Z"
            fill="#d8ccb0"
            stroke="#506b62"
            strokeWidth="3"
          />
        </g>
        <path
          d="m-95 97 16-7m34 26 18-2m105-22 14-10"
          stroke="#c08e63"
          strokeWidth="5"
          strokeLinecap="round"
          opacity=".65"
        />
      </g>

      {/* Tools and replacement part rest on a real work mat, not a HUD. */}
      <path d="M295 626H790V750H295Z" fill="#473f32" opacity=".3" />
      <path
        d="M290 616H785V736H290Z"
        fill="#35554e"
        stroke="#233f3b"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M302 628H773V724H302Z"
        fill="none"
        stroke="#7e9985"
        strokeWidth="2"
        strokeDasharray="7 7"
      />
      <Part
        label="Pegue a chave"
        enabled={state.phase === 'tool'}
        onActivate={() => dispatch({ type: 'tool' })}
        transform="translate(389 668) rotate(-31)"
      >
        <rect x="-42" y="-105" width="84" height="200" fill="transparent" />
        <path
          d="M-13-38-25-52l-4-29 18 16 15-7-1-25 20 23-3 24-13 16v69l12 17-4 22-19 8-18-15 2-21 10-11Z"
          fill="#aec0af"
          stroke="#203e39"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M-2-30v60" stroke="#7d9c8a" strokeWidth="5" strokeLinecap="round" />
      </Part>
      <Part
        label="Pegue o cubo de reposição"
        enabled={state.phase === 'replacement'}
        onActivate={() => dispatch({ type: 'replacement' })}
        transform="translate(567 674) scale(.8)"
      >
        <g opacity={['install', 'tighten', 'complete'].includes(state.phase) ? 0.15 : 1}>
          <circle r="58" fill="#b9cbb6" stroke="#203e39" strokeWidth="6" />
          <circle r="35" fill="#719581" stroke="#e1d8b4" strokeWidth="5" />
          <path d="m0-24 21 12v24L0 24-21 12v-24Z" fill="#355b50" />
          {[0, 120, 240].map((angle) => (
            <circle
              key={angle}
              cx="0"
              cy="-46"
              r="6"
              transform={`rotate(${angle})`}
              fill="#34594f"
            />
          ))}
        </g>
      </Part>
      <g fill="#c6cfb7" stroke="#24453e" strokeWidth="3">
        <path d="m660 657 9-5 9 5v10l-9 5-9-5Z" />
        <path d="m681 678 9-5 9 5v10l-9 5-9-5Z" />
        <path d="m641 689 9-5 9 5v10l-9 5-9-5Z" />
      </g>
      <path d="m820 518 46 18-28 48-43-17Z" fill="#d2a061" stroke="#795438" strokeWidth="4" />
      <path d="m822 523 9 3-28 45-9-4m50-34 9 3-28 45-9-4" stroke="#66553d" strokeWidth="5" />
    </svg>
  );
}
