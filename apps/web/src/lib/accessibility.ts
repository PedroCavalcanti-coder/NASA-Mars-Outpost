import { create } from 'zustand';

export type ColorMode = 'none' | 'protan' | 'deutan' | 'tritan';

export interface A11y {
  colorMode: ColorMode;
  /** mais contraste e cores mais fortes */
  contrast: boolean;
  /** sem tremor de tela, neve, aurora nem piscadas */
  calm: boolean;
  /** botões maiores (mais fácil de tocar) */
  bigTargets: boolean;
  /** texto mais forte e com mais espaço entre as letras */
  readable: boolean;
  /** lê em voz alta (voz do navegador) falas do B.I.T., tutorial, avisos e eventos */
  narrate: boolean;
  /** voz mais devagar */
  narrateSlow: boolean;
}

const KEY = 'mo_a11y';
const DEFAULT: A11y = { colorMode: 'none', contrast: false, calm: false, bigTargets: false, readable: false, narrate: false, narrateSlow: false };

function read(): A11y {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<A11y>;
    return {
      colorMode: ['protan', 'deutan', 'tritan'].includes(v.colorMode as string) ? (v.colorMode as ColorMode) : 'none',
      contrast: v.contrast === true,
      calm: v.calm === true,
      bigTargets: v.bigTargets === true,
      readable: v.readable === true,
      narrate: v.narrate === true,
      narrateSlow: v.narrateSlow === true,
    };
  } catch {
    return DEFAULT;
  }
}

type M3 = [[number, number, number], [number, number, number], [number, number, number]];
/** Como quem tem cada tipo de daltonismo enxerga (aproximação). */
const SIM: Record<Exclude<ColorMode, 'none'>, M3> = {
  protan: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  deutan: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritan: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
};
/** Para onde mandar a informação de cor que se perde (vermelho/verde → verde/azul; azul/amarelo → vermelho/verde). */
const SHIFT: Record<Exclude<ColorMode, 'none'>, M3> = {
  protan: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]],
  deutan: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]],
  tritan: [[1, 0, 0.7], [0, 1, 0.7], [0, 0, 0]],
};

/** Matriz de "daltonização": cor original + (o que se perde, redistribuído em canais que a pessoa vê). */
export function daltonize(mode: Exclude<ColorMode, 'none'>): number[] {
  const s = SIM[mode];
  const c = SHIFT[mode];
  const err: M3 = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) - s[i]![j]!)) as M3;
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const row = [0, 1, 2].map((j) => (i === j ? 1 : 0) + c[i]!.reduce((sum, cv, k) => sum + cv * err[k]![j]!, 0));
    out.push(...row, 0, 0);
  }
  out.push(0, 0, 0, 1, 0);
  return out;
}

function ensureFilters() {
  if (document.getElementById('mo-a11y-filters')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'mo-a11y-filters';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = (['protan', 'deutan', 'tritan'] as const)
    .map(
      (m) =>
        `<filter id="mo-cb-${m}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${daltonize(m)
          .map((n) => n.toFixed(4))
          .join(' ')}"/></filter>`,
    )
    .join('');
  document.body.appendChild(svg);
}

/** Liga/desliga as opções no <html> (o CSS em styles/accessibility.css faz o resto). */
export function applyA11y(a: A11y) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (a.colorMode !== 'none') ensureFilters();
  const set = (name: string, on: boolean) => (on ? root.setAttribute(name, '') : root.removeAttribute(name));
  if (a.colorMode === 'none') root.removeAttribute('data-cb');
  else root.setAttribute('data-cb', a.colorMode);
  set('data-contrast', a.contrast);
  set('data-calm', a.calm);
  set('data-bigtargets', a.bigTargets);
  set('data-readable', a.readable);
}

export const useA11y = create<A11y & { update: (patch: Partial<A11y>) => void }>((set, get) => ({
  ...read(),
  update: (patch) => {
    const next = { ...get(), ...patch };
    set(patch);
    try {
      const { update: _u, ...data } = next;
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* opcional */
    }
    applyA11y(next);
  },
}));

/** Chamado uma vez ao abrir o site: aplica o que a pessoa escolheu da última vez. */
export function initA11y() {
  const { update: _u, ...a } = useA11y.getState();
  applyA11y(a);
}
