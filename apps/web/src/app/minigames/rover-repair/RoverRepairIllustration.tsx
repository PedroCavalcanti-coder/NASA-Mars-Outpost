import { useId, useSyncExternalStore } from 'react';

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

/** Static equipment artwork. No repair state, timers or base resource dependencies. */
export function RoverRepairIllustration() {
  const id = useId().replace(/:/g, '');
  const portrait = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(portraitQuery).matches,
    () => false,
  );
  const metal = `${id}-metal`;
  const tire = `${id}-tire`;
  const floor = `${id}-floor`;
  return (
    <svg
      className="rover-repair-art"
      viewBox={portrait ? '245 0 600 900' : '0 0 1100 820'}
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
    >
      <title id={`${id}-title`}>Reparo do rover</title>
      <desc id={`${id}-description`}>
        Inspecione a roda e substitua a peça danificada. Rover elevado em um macaco na oficina
        marciana. A roda dianteira tem uma fissura no cubo e um parafuso solto. Uma chave, parafusos
        novos e um cubo de reposição estão na bancada. Esta é uma prévia visual, sem reparo ativo.
      </desc>
      <defs>
        <linearGradient id={metal} x2="0.8" y2="1">
          <stop stopColor="#d2dac2" />
          <stop offset="0.5" stopColor="#a6b6a5" />
          <stop offset="1" stopColor="#6f8a80" />
        </linearGradient>
        <radialGradient id={tire} cx="40%" cy="30%" r="70%">
          <stop stopColor="#4b5b53" />
          <stop offset="1" stopColor="#253735" />
        </radialGradient>
        <linearGradient id={floor} x2="0" y2="1">
          <stop stopColor="#ba805d" />
          <stop offset="1" stopColor="#785343" />
        </linearGradient>
      </defs>

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
      <path d="M-50 394Q430 350 1150 401V950H-50Z" fill={`url(#${floor})`} />
      <path d="M-30 0H1140V42H-30ZM40 0H73V402H40ZM1025 0H1060V402H1025Z" fill="#2d423e" />
      <path d="M-10 53H1120M85 397H1005" stroke="#e6cba5" strokeWidth="4" opacity=".25" />
      <path
        d="m50 580 1000-36M-60 780 1120 735M270 405 60 880M780 400l260 480"
        fill="none"
        stroke="#d6a47b"
        strokeWidth="2"
        opacity=".2"
      />
      <ellipse cx="553" cy="576" rx="344" ry="42" fill="#382e2a" opacity=".28" />

      {/* Rover body: rounded enamel panels and exposed suspension. */}
      <path
        d="m192 320 114-84 416 35 105 100-17 87-575-27Z"
        fill="#304542"
        stroke="#263b38"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <path
        d="m202 252 150-88 334 33 103 112-42 79-505-43Z"
        fill="#c4c9ac"
        stroke="#3b5149"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path
        d="m351 164 12-64 220 17 63 100Z"
        fill="#e0d9b9"
        stroke="#3b5149"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path d="m386 117 92 7 2 59-108-10Z" fill="#476e6c" />
      <path d="m492 125 72 7 34 57-102-6Z" fill="#315857" />
      <path d="m397 126 17 2-33 35-4-1Z" fill="#a6c8b6" opacity=".5" />
      <path d="m270 225 410 36 47 51-487-42Z" fill="#e3ddbd" />
      <path
        d="m263 295 160 18m-150 1 119 14"
        stroke="#708377"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M524 135V66m-13 2h27" stroke="#304b46" strokeWidth="7" strokeLinecap="round" />
      <circle cx="525" cy="61" r="8" fill="#d3ba79" />
      <rect
        x="679"
        y="284"
        width="44"
        height="25"
        rx="9"
        fill="#f1d48f"
        stroke="#788578"
        strokeWidth="5"
        transform="rotate(7 679 284)"
      />
      <Wheel x={253} y={410} />
      <Wheel x={798} y={424} radius={51} />
      <path
        d="m344 363 205 76 179-63"
        fill="none"
        stroke="#293f3a"
        strokeWidth="29"
        strokeLinecap="round"
      />
      <path
        d="m344 357 205 76 179-63"
        fill="none"
        stroke="#81917e"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="m452 437-24 128h113l-30-128"
        fill="#b56c44"
        stroke="#573f32"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path d="M471 430v99m-29 21h89" stroke="#e1b681" strokeWidth="8" strokeLinecap="round" />

      {/* Foreground wheel, its damaged hub and exposed fixings. */}
      <g transform="translate(590 409)">
        <circle cx="9" cy="12" r="181" fill="#273731" />
        <circle r="177" fill={`url(#${tire})`} stroke="#203734" strokeWidth="10" />
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
        <circle r="116" fill={`url(#${metal})`} stroke="#1e3836" strokeWidth="8" />
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
        <circle r="63" fill="#cfb38a" stroke="#536f64" strokeWidth="8" />
        <circle r="46" fill="#8e9a83" stroke="#dbcc9f" strokeWidth="5" />
        <path
          d="m-8-43 15 21-13 15 17 15-8 17 14 22"
          fill="none"
          stroke="#594b39"
          strokeWidth="9"
          strokeLinejoin="round"
        />
        <path
          d="m-7-43 15 21-13 15 17 15-8 17 14 22"
          fill="none"
          stroke="#e8c096"
          strokeWidth="2"
        />
        {[30, 150, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle}) translate(0 -78)`}>
            <path
              d="m-10-6 10-6 10 6v12l-10 6-10-6Z"
              fill="#e2dbb8"
              stroke="#506b62"
              strokeWidth="3"
            />
            <path d="M-5 0H5" stroke="#60766a" strokeWidth="3" />
          </g>
        ))}
        <g transform="translate(70 40) rotate(32)">
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
      <path d="m307 656 352-28 122 104-354 34Z" fill="#473f32" opacity=".3" />
      <path
        d="m303 628 344-23 127 115-359 27Z"
        fill="#35554e"
        stroke="#233f3b"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="m321 637 321-22 108 98-332 25Z"
        fill="none"
        stroke="#7e9985"
        strokeWidth="2"
        strokeDasharray="7 7"
      />
      <g transform="translate(389 668) rotate(-31)">
        <path
          d="M-13-38-25-52l-4-29 18 16 15-7-1-25 20 23-3 24-13 16v69l12 17-4 22-19 8-18-15 2-21 10-11Z"
          fill="#aec0af"
          stroke="#203e39"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M-2-30v60" stroke="#7d9c8a" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g transform="translate(567 667) scale(1 .65)">
        <ellipse cy="15" rx="61" ry="62" fill="#213e39" />
        <circle r="58" fill="#b9cbb6" stroke="#203e39" strokeWidth="6" />
        <circle r="35" fill="#719581" stroke="#e1d8b4" strokeWidth="5" />
        <path d="m0-24 21 12v24L0 24-21 12v-24Z" fill="#355b50" />
        {[0, 120, 240].map((angle) => (
          <circle key={angle} cx="0" cy="-46" r="6" transform={`rotate(${angle})`} fill="#34594f" />
        ))}
      </g>
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
