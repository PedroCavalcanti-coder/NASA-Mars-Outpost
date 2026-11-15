import { Droplets, RotateCcw } from 'lucide-react';
import { useId } from 'react';
import { CROPS, type CropIndex, healthy, plantHealth } from './greenhouseState';
import type { useGreenhouse } from './useGreenhouse';

/** Vector counterpart of the base's hydroponic beds and crop stages. */
function Plant({
  x,
  y,
  scale = 1,
  health = 1,
  fruit = false,
}: {
  x: number;
  y: number;
  scale?: number;
  health?: number;
  fruit?: boolean;
}) {
  const thirsty = health < 0.9;
  const leaves = [
    { y: -26, angle: -16, flip: 1 },
    { y: -46, angle: 12, flip: -1 },
    { y: -70, angle: -12, flip: 1 },
    { y: -94, angle: 8, flip: -1 },
    { y: -112, angle: -25, flip: 1 },
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cy="4" rx="43" ry="10" fill="#152d2b" opacity=".35" />
      <path
        d="M0 3Q-8-65 5-131"
        fill="none"
        stroke={thirsty ? '#79924b' : '#467942'}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {leaves.map(({ y: leafY, angle, flip }) => (
        <g key={leafY} transform={`translate(0 ${leafY}) scale(${flip} 1)`}>
          <g
            className="greenhouse-leaf"
            style={{ transform: `rotate(${angle - 54 * (1 - health)}deg)` }}
          >
            <path
              d="M0 0C-11-29-44-40-67-31C-60-4-27 13 0 0Z"
              fill={thirsty ? '#9baf5d' : '#69a95a'}
              stroke={thirsty ? '#6d8442' : '#417646'}
              strokeWidth="2"
            />
            <path
              d="M-3-1Q-29-18-57-26"
              fill="none"
              stroke={thirsty ? '#d1cb7a' : '#b1ce7a'}
              strokeWidth="2"
            />
            <path
              d="m-24-13-3-10m-13 3-3-8m19 15-10 4"
              fill="none"
              stroke="#d1dc924f"
              strokeWidth="1.5"
            />
          </g>
        </g>
      ))}
      <path
        d="M4-125Q-17-154 6-169Q28-151 4-125Z"
        fill={thirsty ? '#b4bb6b' : '#97c36d'}
        stroke="#5d8c4c"
        strokeWidth="2"
      />
      {fruit && (
        <g>
          <path
            d="M2-74Q32-81 36-57M-1-43Q-26-54-31-31"
            fill="none"
            stroke="#5a8348"
            strokeWidth="3"
          />
          <circle cx="36" cy="-47" r="14" fill="#e97f4c" stroke="#aa573b" strokeWidth="2" />
          <circle cx="-31" cy="-21" r="12" fill="#c8b957" stroke="#87934d" strokeWidth="2" />
          <path d="m28-59 8 5 7-5m-81 28 7 4 6-4" fill="none" stroke="#4e7742" strokeWidth="3" />
          <path
            d="M30-48q-1-6 5-7"
            fill="none"
            stroke="#ffc39b"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}

function Seedling({ x, y, mirror = false }: { x: number; y: number; mirror?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${mirror ? -1 : 1} 1)`}>
      <ellipse cy="3" rx="22" ry="6" fill="#152d2b" opacity=".35" />
      <path
        d="M0 2Q-2-18 3-36"
        fill="none"
        stroke="#55904c"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M0-14Q-33-10-32-38Q-4-41 0-14" fill="#80b863" stroke="#50884a" strokeWidth="2" />
      <path d="M2-27Q30-23 34-51Q8-57 2-27" fill="#aecf7d" stroke="#629950" strokeWidth="2" />
      <path d="m-3-17-20-14m29 0 20-13" stroke="#d9e4a6" fill="none" strokeWidth="2" />
    </g>
  );
}

type GreenhouseGame = ReturnType<typeof useGreenhouse>;

function CropBed({
  index,
  game,
  lightFill,
  bedFill,
}: {
  index: CropIndex;
  game: GreenhouseGame;
  lightFill: string;
  bedFill: string;
}) {
  const crop = game.crops[index];
  const needs = CROPS[index];
  const x = needs.x;
  const ready = healthy(crop, index);
  const health = plantHealth(crop, index);
  const watering = game.watering;
  return (
    <g className="greenhouse-bed" data-crop={index} data-healthy={ready} data-watering={watering}>
      <path d={`M${x - 72} 148V102M${x + 72} 148V102`} stroke="#334e49" strokeWidth="4" />
      <path
        className="greenhouse-light-beam"
        d={`M${x - 83} 169 ${x - 135} 458H${x + 135}L${x + 83} 169Z`}
        fill={lightFill}
        opacity={crop.light / 2}
      />
      <rect
        x={x - 100}
        y="143"
        width="200"
        height="25"
        rx="8"
        fill="#526b5c"
        stroke="#2d4946"
        strokeWidth="3"
      />
      <rect
        x={x - 88}
        y="160"
        width="176"
        height="9"
        rx="4"
        fill={
          crop.light === needs.light ? '#f4e8a5' : crop.light > needs.light ? '#fff6da' : '#9dbe99'
        }
      />
      <path d={`M${x - 80} 149H${x + 80}`} stroke="#95aa89" strokeWidth="3" />
      {[0, 1, 2].map((bulb) => (
        <circle
          key={bulb}
          cx={x - 13 + bulb * 13}
          cy="153"
          r="3"
          fill={bulb < crop.light ? '#fff1ae' : '#2f4b40'}
        />
      ))}
      <path d={`M${x} 284V311`} stroke="#72968a" strokeWidth="7" />
      <path d={`M${x - 20} 311H${x + 20}`} stroke="#b6c7a6" strokeWidth="7" strokeLinecap="round" />
      {watering && (
        <g className="greenhouse-water-drops">
          {[-16, 0, 16].map((dx, drop) => (
            <path
              key={dx}
              d={`M${x + dx} 319v9`}
              stroke="#a7e4dc"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ animationDelay: `${drop * -0.16}s` }}
            />
          ))}
        </g>
      )}
      <ellipse cx={x} cy="584" rx="123" ry="23" fill="#203c36" opacity=".4" />
      <path
        d={`M${x - 79} 491 ${x - 90} 580M${x + 79} 491 ${x + 90} 580`}
        stroke="#273f3b"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d={`M${x - 79} 491 ${x - 90} 580M${x + 79} 491 ${x + 90} 580`}
        stroke="#819781"
        strokeWidth="8"
      />
      <path
        d={`M${x - 109} 427H${x + 109}L${x + 96} 521Q${x} 541 ${x - 96} 521Z`}
        fill={bedFill}
        stroke="#304e46"
        strokeWidth="4"
      />
      <path
        d={`M${x - 105} 476Q${x} 490 ${x + 105} 476`}
        fill="none"
        stroke="#7d9a8c"
        strokeWidth="3"
      />
      <rect
        x={x - 116}
        y="418"
        width="232"
        height="30"
        rx="12"
        fill="#d9ddbb"
        stroke="#3a5a4d"
        strokeWidth="4"
      />
      <rect
        x={x - 103}
        y="423"
        width="206"
        height="14"
        rx="7"
        fill={crop.water >= needs.water ? '#496b4d' : '#77664a'}
      />
      <rect
        x={x + 43}
        y="465"
        width="44"
        height="39"
        rx="5"
        fill="#2f4b43"
        stroke="#729582"
        strokeWidth="3"
      />
      <rect
        className="greenhouse-reservoir"
        x={x + 47}
        y={500 - (30 * crop.water) / needs.water}
        width="36"
        height={(30 * crop.water) / needs.water}
        rx="2"
        fill="#80c8c1"
      />
      <circle
        cx={x - 75}
        cy="490"
        r="6"
        fill={ready ? '#bfe28a' : '#a89368'}
        className="greenhouse-ready-light"
      />
      <circle cx={x - 18} cy="492" r="23" fill="#e0d8b5" stroke="#395c52" strokeWidth="4" />
      <circle cx={x - 18} cy="492" r="16" fill="#5b9c9c" />
      <g
        className="greenhouse-valve"
        style={{
          transformOrigin: `${x - 18}px 492px`,
          transform: `rotate(${crop.water * 300}deg)`,
        }}
      >
        <path
          d={`M${x - 18} 481v22M${x - 29} 492h22`}
          stroke="#d5e6cd"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
      <foreignObject x={x + 50} y="507" width="30" height="25">
        <Droplets className="greenhouse-water-mark" />
      </foreignObject>
      {index === 0 ? (
        <g
          className="greenhouse-seedlings"
          style={{
            opacity: 0.5 + health / 2,
            transformOrigin: `${x}px 430px`,
            transform: `scaleY(${0.75 + health * 0.25})`,
          }}
        >
          <Seedling x={185} y={430} />
          <Seedling x={241} y={429} mirror />
          <Seedling x={295} y={430} />
        </g>
      ) : index === 1 ? (
        <>
          <Plant x={460} y={430} scale={0.72} health={health} />
          <Plant x={535} y={430} scale={0.86} health={health} />
        </>
      ) : (
        <>
          <Plant x={719} y={430} scale={0.89} health={health} fruit />
          <Plant x={799} y={430} scale={1.12} health={health} fruit />
        </>
      )}
    </g>
  );
}

export function GreenhouseIllustration({ game }: { game: GreenhouseGame }) {
  const id = useId();
  return (
    <svg
      className="greenhouse-art"
      viewBox="0 0 1000 660"
      aria-labelledby={`${id}-title ${id}-description`}
    >
      <title id={`${id}-title`}>Uma pequena estufa em Marte</title>
      <desc id={`${id}-description`}>
        Canteiros hidropônicos com brotos, plantas de folhas levemente murchas e tomateiros adultos.
        Segure a válvula na tubulação à esquerda para regar todos os canteiros. As folhas e os
        sinais verdes mostram a recuperação.
      </desc>
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1">
          <stop stopColor="#6c8585" />
          <stop offset="1" stopColor="#dbad82" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x2="0" y2="1">
          <stop stopColor="#b4ceab" stopOpacity=".22" />
          <stop offset="1" stopColor="#283e3b" stopOpacity=".15" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x2="0" y2="1">
          <stop stopColor="#f8eeb3" stopOpacity=".22" />
          <stop offset="1" stopColor="#edf0b2" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-bed`} x2="0" y2="1">
          <stop stopColor="#e6ddba" />
          <stop offset="1" stopColor="#a4b2a0" />
        </linearGradient>
        <clipPath id={`${id}-window`}>
          <path d="M35 408V218Q35 38 220 38H780Q965 38 965 218V408Z" />
        </clipPath>
        <pattern
          id={`${id}-floor`}
          width="90"
          height="40"
          patternUnits="userSpaceOnUse"
          patternTransform="skewX(-22)"
        >
          <path d="M0 0H90V40" fill="none" stroke="#e7d4ac" strokeOpacity=".12" strokeWidth="2" />
        </pattern>
      </defs>

      <path
        d="M16 660V229Q16 17 225 17H775Q984 17 984 229V660"
        fill="#3b5755"
        stroke="#253f41"
        strokeWidth="16"
      />
      <g clipPath={`url(#${id}-window)`}>
        <path d="M0 0H1000V460H0Z" fill={`url(#${id}-sky)`} />
        <circle cx="808" cy="132" r="30" fill="#f5ddac" opacity=".55" />
        <path
          d="m-30 321 119-109 66 19 71 73 99-21 96-106 70 24 113 126 121-82 83-18 118 102 80-16V480H-30Z"
          fill="#b8775e"
        />
        <path
          d="m89 212 66 19 71 73-85-24Zm332-35 70 24 113 126-129-42Zm304 68 83-18 118 102-110-37Z"
          fill="#cc9470"
        />
        <path d="M0 365Q170 317 311 366T603 361 1000 345V480H0Z" fill="#d39a6f" />
        <path d="m0 417 169-38 100 40 167-15 120 28 218-53 226 21v80H0Z" fill="#b57d58" />
        <path d="M0 25H1000V440H0Z" fill={`url(#${id}-glass)`} />
        <path
          d="m270 0-98 440M315 0l-98 440M830 0l-98 440"
          stroke="#e0ebc5"
          strokeWidth="24"
          opacity=".08"
        />
      </g>

      <path
        d="M35 408V218Q35 38 220 38H780Q965 38 965 218V408M34 408H966"
        fill="none"
        stroke="#b4c0a5"
        strokeWidth="14"
      />
      <path
        d="M220 41Q125 191 174 407M500 38V408M780 41Q875 191 826 407"
        fill="none"
        stroke="#344f4d"
        strokeWidth="18"
      />
      <path
        d="M220 41Q125 191 174 407M500 38V408M780 41Q875 191 826 407"
        fill="none"
        stroke="#91a88f"
        strokeWidth="9"
      />
      <path d="M44 230H957" fill="none" stroke="#91a88f" strokeWidth="9" />
      <path d="M0 660V434H1000V660Z" fill="#425953" />
      <path d="M0 660V434H1000V660Z" fill={`url(#${id}-floor)`} />
      <path d="M0 432H1000" stroke="#263f3d" strokeWidth="16" />

      {/* Canteiros distantes representam o restante da estufa. */}
      {[250, 710].map((x) => (
        <g key={x} aria-hidden="true" opacity=".68" transform={`translate(${x} 385) scale(.42)`}>
          <rect x="-145" y="-24" width="290" height="65" rx="12" fill="#a8b8a2" stroke="#49645a" strokeWidth="6" />
          <ellipse cy="-20" rx="140" ry="18" fill="#526d56" />
          <Plant x={-85} y={-24} scale={0.6} />
          <Plant x={0} y={-24} scale={0.7} />
          <Plant x={85} y={-24} scale={0.6} />
        </g>
      ))}

      <path
        d="M72 576V304Q72 280 100 280H907Q932 280 932 307V576"
        fill="none"
        stroke="#29494a"
        strokeWidth="17"
      />
      <path
        d="M72 576V304Q72 280 100 280H907Q932 280 932 307V576"
        fill="none"
        stroke="#86a89b"
        strokeWidth="10"
      />
      <g className="greenhouse-main-valve" data-watering={game.watering} aria-hidden="true">
        <circle cx="72" cy="410" r="31" fill="#365751" stroke="#203f3e" strokeWidth="5" />
        <g className="greenhouse-valve-wheel">
          <circle cx="72" cy="410" r="24" fill="#d99545" stroke="#f5d294" strokeWidth="5" />
          <path d="M72 389v42M51 410h42" stroke="#ffe1a6" strokeWidth="6" strokeLinecap="round" />
          <circle cx="72" cy="410" r="6" fill="#735333" />
        </g>
      </g>
      <foreignObject x="33" y="371" width="78" height="78">
        <button
          type="button"
          className="greenhouse-control greenhouse-water-control"
          disabled={game.complete}
          aria-label="Segure para irrigar todas as plantas"
          title="Segure para irrigar"
          onPointerDown={game.down}
          onPointerUp={game.up}
          onPointerCancel={game.up}
          onLostPointerCapture={game.up}
          onKeyDown={game.keyDown}
          onKeyUp={game.keyUp}
          onBlur={game.stop}
          onClick={(event) => {
            if (event.detail === 0) game.waterStep();
          }}
        />
      </foreignObject>
      {CROPS.map((crop) => (
        <CropBed
          key={crop.x}
          index={crop.index}
          game={game}
          lightFill={`url(#${id}-light)`}
          bedFill={`url(#${id}-bed)`}
        />
      ))}
      <path d="M17 643H983" stroke="#829681" strokeWidth="12" />
      {[65, 935].map((x) => (
        <g key={x}>
          <circle cx={x} cy="622" r="7" fill="#293f3b" />
          <path d={`m${x - 3} 619 6 6`} stroke="#9aac90" strokeWidth="2" />
        </g>
      ))}
      {game.complete && (
        <foreignObject x="455" y="565" width="90" height="66">
          <button
            type="button"
            className="greenhouse-replay"
            onClick={game.reset}
            aria-label="Cuidar novamente"
            title="Cuidar novamente"
          >
            <RotateCcw size={28} />
          </button>
        </foreignObject>
      )}
    </svg>
  );
}
