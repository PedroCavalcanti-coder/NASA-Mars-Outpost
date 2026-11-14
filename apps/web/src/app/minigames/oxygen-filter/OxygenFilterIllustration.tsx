import { type KeyboardEvent, type PointerEvent, useId } from 'react';

export const OXYGEN_DEBRIS = [
  { x: 90, y: 74, size: 29, angle: -18 },
  { x: 270, y: 61, size: 22, angle: 28 },
  { x: 364, y: 133, size: 33, angle: -35 },
  { x: 195, y: 157, size: 36, angle: 12 },
  { x: 75, y: 225, size: 25, angle: 39 },
  { x: 285, y: 253, size: 28, angle: -12 },
  { x: 387, y: 284, size: 18, angle: 21 },
];
const GRAINS = Array.from({ length: 100 }, (_, i) => ({
  id: `grain-${i}`,
  x: 28 + ((i * 137.3) % 400),
  y: 32 + ((i * 67.7) % 280),
  r: 0.8 + (i % 3),
}));

export function OxygenDebris() {
  return (
    <>
      <ellipse cy="12" rx="27" ry="15" fill="#634634" opacity=".3" />
      <path
        d="m-26 0 13-20 27 3L29 3 13 23l-30-4Z"
        fill="#995c3e"
        stroke="#7e4b35"
        strokeWidth="2"
      />
      <path d="m-26 0 13-20 27 3L4-1Z" fill="#e0a06a" />
      <path d="M4-1 29 3 13 23-3 10Z" fill="#b9754b" />
      <path d="m-13-20 3 13 14 6" fill="none" stroke="#f2bf8280" strokeWidth="2" />
    </>
  );
}

export function OxygenFilterIllustration({
  removed,
  selected,
  dragging,
  onDown,
  onMove,
  onUp,
  onCancel,
  onSelect,
}: {
  removed: ReadonlySet<number>;
  selected: number | null;
  dragging: boolean;
  onDown: (event: PointerEvent<SVGGElement>, id: number) => void;
  onMove: (event: PointerEvent<SVGGElement>) => void;
  onUp: (event: PointerEvent<SVGGElement>) => void;
  onCancel: (event: PointerEvent<SVGGElement>) => void;
  onSelect: (event: KeyboardEvent<SVGGElement>, id: number) => void;
}) {
  const id = useId();
  return (
    <svg
      className="oxygen-filter-art"
      viewBox="0 0 460 360"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>Filtro de oxigênio parcialmente obstruído</title>
      <desc id={`${id}-desc`}>
        Filtro de dobras claras com partes limpas visíveis, coberto por poeira alaranjada,
        fragmentos de rocha. Arraste os detritos até o descarte. No teclado, selecione um detrito
        com Enter e ative o descarte.
      </desc>
      <defs>
        <linearGradient id={`${id}-pleat`}>
          <stop stopColor="#587879" />
          <stop offset=".2" stopColor="#b7cfb9" />
          <stop offset=".5" stopColor="#e6e6c8" />
          <stop offset=".8" stopColor="#c6d4bb" />
          <stop offset="1" stopColor="#526e70" />
        </linearGradient>
        <linearGradient id={`${id}-dust`} x2=".5" y2="1">
          <stop stopColor="#e3ac70" />
          <stop offset="1" stopColor="#b97048" />
        </linearGradient>
        <pattern id={`${id}-folds`} width="23" height="310" patternUnits="userSpaceOnUse">
          <rect width="23" height="310" fill={`url(#${id}-pleat)`} />
          <path d="M6 0V310" stroke="#f1efcc" strokeOpacity=".4" />
        </pattern>
        <pattern id={`${id}-mesh`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 0H8V8" fill="none" stroke="#304f4a" strokeOpacity=".13" />
        </pattern>
        <clipPath id={`${id}-filter`}>
          <rect x="25" y="25" width="410" height="310" rx="12" />
        </clipPath>
      </defs>
      <rect x="8" y="8" width="444" height="344" rx="20" fill="#253d43" />
      <rect
        x="14"
        y="13"
        width="432"
        height="332"
        rx="16"
        fill="#81988b"
        stroke="#c6cfb4"
        strokeWidth="3"
      />
      <g clipPath={`url(#${id}-filter)`}>
        <rect x="25" y="25" width="410" height="310" fill={`url(#${id}-folds)`} />
        <rect x="25" y="25" width="410" height="310" fill={`url(#${id}-mesh)`} />
        <g className="oxygen-dust" opacity={1 - removed.size / OXYGEN_DEBRIS.length}>
          <path
            d="M25 25H435V167Q405 193 377 163T327 145 292 183 228 195 190 131 143 114 90 157 25 122Z"
            fill={`url(#${id}-dust)`}
            opacity=".83"
          />
          <path
            d="M25 215Q81 185 137 244T235 265 318 228 435 255V335H25Z"
            fill={`url(#${id}-dust)`}
            opacity=".7"
          />
          <path
            d="M25 58Q115 101 163 70T299 83 435 48M25 287Q103 268 187 298T435 292"
            fill="none"
            stroke="#f7ce9340"
            strokeWidth="12"
          />
          {GRAINS.map(({ id: grainId, x, y, r }) => (
            <circle key={grainId} cx={x} cy={y} r={r} fill="#754b34" opacity=".3" />
          ))}
        </g>
        <path d="M42 113H418M42 235H418" stroke="#2e5556" strokeWidth="10" opacity=".16" />
        <path d="M42 109H418M42 231H418" stroke="#acb89c" strokeWidth="5" />
        {OXYGEN_DEBRIS.map(({ x, y, size, angle }, index) =>
          removed.has(index) ? null : (
            // biome-ignore lint/a11y/useSemanticElements: Interactive SVG geometry requires an SVG group, with Enter and Space keyboard controls.
            <g
              key={`${x}-${y}`}
              role="button"
              tabIndex={0}
              aria-label={`Detrito ${index + 1}. Arraste até o descarte ou pressione Enter para selecionar.`}
              aria-pressed={selected === index}
              className="oxygen-debris"
              data-selected={selected === index}
              style={{ opacity: dragging && selected === index ? 0 : 1 }}
              transform={`translate(${x} ${y}) rotate(${angle}) scale(${size / 30})`}
              onPointerDown={(event) => onDown(event, index)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onCancel}
              onLostPointerCapture={onCancel}
              onKeyDown={(event) => onSelect(event, index)}
            >
              <circle r="42" fill="transparent" />
              <OxygenDebris />
            </g>
          ),
        )}
      </g>
      <path d="M49 18H411M49 342H411" stroke="#e3dfbe" strokeWidth="3" />
      {[
        [23, 22],
        [437, 22],
        [23, 338],
        [437, 338],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#3a5357" />
      ))}
    </svg>
  );
}
