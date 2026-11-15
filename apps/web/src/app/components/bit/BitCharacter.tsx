import { useId } from 'react';
import type { Expression } from '../../../game/guide/catalog';

/** Original layered vector artwork. Text and dialogue deliberately live outside the illustration. */
export function BitCharacter({ expression = 'idle' }: { expression?: Expression }) {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;
  return (
    <svg
      viewBox="0 0 260 250"
      role="img"
      aria-label={`B.I.T., ${expression}`}
      data-expression={expression}
      className="bit-character"
    >
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2=".75" y2="1">
          <stop stopColor="#fff" />
          <stop offset=".48" stopColor="#f7f5ff" />
          <stop offset="1" stopColor="#9da9ca" />
        </linearGradient>
        <linearGradient id={`${id}-orange`} x2=".3" y2="1">
          <stop stopColor="#ffe27c" />
          <stop offset=".4" stopColor="#ffad30" />
          <stop offset="1" stopColor="#e56723" />
        </linearGradient>
        <radialGradient id={`${id}-screen`} cx=".5" cy=".2" r=".9">
          <stop stopColor="#173b5c" />
          <stop offset="1" stopColor="#080e25" />
        </radialGradient>
        <linearGradient id={`${id}-metal`} x2="1" y2="1">
          <stop stopColor="#d6e7f7" />
          <stop offset=".5" stopColor="#6a84ac" />
          <stop offset="1" stopColor="#283b61" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse cx="120" cy="232" rx="62" ry="7" fill="#101e36" opacity=".2" />
      <g className="bit-body" stroke="#182a43" strokeWidth="4" strokeLinejoin="round">
        <path d="M90 172 87 199Q88 220 117 223L148 215 153 181Z" fill={paint('shell')} />
        <path d="M100 184 104 208 133 209 140 184" fill={paint('metal')} />
        <path d="m94 189 8 20-8 5-13-17Z" fill={paint('orange')} />
        <path d="m146 186 12 12-10 18-10-6Z" fill={paint('orange')} />
        <path d="M108 217 108 230Q119 237 130 228L130 218" fill={paint('metal')} />
        <path d="m113 194 14-2" stroke="#79edff" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g className="bit-head" stroke="#182a43" strokeWidth="4" strokeLinejoin="round">
        <g className="bit-antenna">
          <path d="m66 57-16-25q-6-11-13-4-3 3 0 10l16 28" fill={paint('shell')} />
          <circle cx="40" cy="30" r="5" fill="#99f5ff" strokeWidth="2" />
        </g>
        <path
          d="M40 100Q38 49 98 38L147 38Q199 43 208 95L207 131Q198 166 156 177L91 184Q40 174 33 139Z"
          fill={paint('shell')}
        />
        <path
          d="M71 51Q88 39 109 39l27 9-10 10-28-2-17 7Z"
          fill={paint('orange')}
          strokeWidth="2"
        />
        <path d="m159 43 20 9 8 23-12 3-8-17-12-7Z" fill={paint('orange')} strokeWidth="2" />
        <path
          d="M66 87Q74 68 110 64L164 64Q188 65 193 91L194 124Q190 147 165 153L101 162Q68 164 61 143Z"
          fill={paint('metal')}
          strokeWidth="3"
        />
        <path
          d="M70 91Q76 74 111 70L161 70Q184 71 186 94L187 121Q184 141 161 146L101 154Q76 156 69 139Z"
          fill={paint('screen')}
        />
        <path
          d="M82 84Q111 71 145 75"
          fill="none"
          stroke="#7fbbdb"
          strokeWidth="3"
          opacity=".28"
          strokeLinecap="round"
        />
        <path
          d="M50 79q2-11 11-13"
          stroke="white"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        <g className="bit-eyes" fill="none" stroke="#6cecff" strokeWidth="8" strokeLinecap="round">
          <g filter={paint('glow')} opacity=".8">
            <path d="M90 119q0-26 20-25t18 21M146 113q-1-25 16-24t16 20" />
          </g>
          <path className="bit-eye-left" d="M90 119q0-26 20-25t18 21" />
          <path className="bit-eye-right" d="M146 113q-1-25 16-24t16 20" />
        </g>
        <g className="bit-cheeks" stroke="#3997bd" strokeWidth="3" opacity=".65">
          <path d="m86 134 7-1m77-8 6-1" />
        </g>
        <g>
          <path
            d="M38 89Q18 86 15 112L18 141Q25 161 47 151L60 140 56 103Z"
            fill={paint('orange')}
          />
          <path d="M32 96Q14 100 21 132 24 149 36 147L48 137 44 105Z" fill={paint('shell')} />
          <ellipse
            cx="33"
            cy="122"
            rx="10"
            ry="19"
            fill="#35b9dc"
            stroke="#36758d"
            strokeWidth="3"
          />
          <path d="m48 99 5 40m-8-34 4 30" stroke="#fff0ad" strokeWidth="2" />
        </g>
        <path d="m196 86 12 5 7 27-9 19-10-4" fill={paint('orange')} />
      </g>
      <g className="bit-hand" stroke="#182a43" strokeWidth="4" strokeLinejoin="round">
        <path d="M148 186q22 21 39-3l11-17-14-13-17 25-16-5Z" fill={paint('orange')} />
        <path d="m178 166 11 14 12-12-11-14Z" fill={paint('metal')} />
        <path
          d="M186 156q-8-8-2-15 5-6 10 0l3 3 2-16q2-10 9-8 6 1 4 11l-2 13 7-3q10-4 12 4 2 5-5 10l-11 8q-14 14-27-7Z"
          fill={paint('shell')}
        />
        <path
          d="m200 144 7 5m-12 1 7 6"
          fill="none"
          stroke="#8f9db9"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g className="bit-sparks" fill="#ffcb4c" stroke="#f28a25" strokeWidth="1.5">
        <path d="m215 35 1-19 10 2-6 18Z" />
        <path d="m230 43 10-15 7 7-13 12Z" />
        <circle cx="214" cy="44" r="3" />
      </g>
    </svg>
  );
}
