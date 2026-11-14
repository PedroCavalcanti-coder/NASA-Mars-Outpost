/**
 * Sondagem do subsolo (minigame da sonda de perfuração). Funções puras.
 *
 * Inspirado em missões reais:
 * - a broca do rover ExoMars *Rosalind Franklin* desce até 2 m, abaixo da camada esterilizada
 *   pela radiação, onde moléculas orgânicas podem ter sobrevivido;
 * - o Perseverance perfura núcleos de rocha e os lacra em tubos para trazê-los à Terra;
 * - a Phoenix encontrou gelo de água a poucos centímetros nas planícies do norte.
 *
 * Cada base tem um perfil de camadas da região real. A ciência do dia pede uma camada; o jogador
 * desce a broca sem superaquecer (camadas duras esquentam mais) e coleta no ponto certo.
 */

import { seeded } from './rules';

export interface Layer {
  id: string;
  name: string;
  /** topo e base da camada (cm) */
  from: number;
  to: number;
  /** dureza: velocidade de avanço e aquecimento da broca */
  hardness: number;
  /** pontos de pesquisa de uma amostra bem coletada */
  research: number;
  color: string;
  fact: string;
}

/** Profundidade máxima da sonda (cm), como a broca do ExoMars. */
export const MAX_DEPTH = 200;

const L = {
  regolito: (to: number): Layer => ({
    id: 'regolito',
    name: 'regolito',
    from: 0,
    to,
    hardness: 0.35,
    research: 3,
    color: '#c46a3c',
    fact: 'Poeira e fragmentos finos de rocha. Os óxidos de ferro dão a cor vermelha de Marte.',
  }),
  gelo: (from: number, to: number): Layer => ({
    id: 'gelo',
    name: 'gelo de água',
    from,
    to,
    hardness: 0.7,
    research: 12,
    color: '#cfe6f0',
    fact: 'A sonda Phoenix achou gelo a poucos centímetros. Água congelada é recurso para futuros astronautas.',
  }),
  argila: (from: number, to: number): Layer => ({
    id: 'argila',
    name: 'argila',
    from,
    to,
    hardness: 0.5,
    research: 10,
    color: '#9a7b5a',
    fact: 'Argilas só se formam com água líquida: sinal de que Marte já teve lagos e rios.',
  }),
  carbonato: (from: number, to: number): Layer => ({
    id: 'carbonato',
    name: 'carbonatos',
    from,
    to,
    hardness: 0.6,
    research: 11,
    color: '#d8c9a8',
    fact: 'Carbonatos na margem do antigo lago de Jezero podem guardar sinais de vida microbiana.',
  }),
  sulfato: (from: number, to: number): Layer => ({
    id: 'sulfato',
    name: 'sulfatos',
    from,
    to,
    hardness: 0.55,
    research: 9,
    color: '#e8dcc0',
    fact: 'Veios de sulfato de cálcio, como os vistos pelo Curiosity em Gale, mostram água circulando nas rochas.',
  }),
  cinza: (from: number, to: number): Layer => ({
    id: 'cinza',
    name: 'cinza vulcânica',
    from,
    to,
    hardness: 0.45,
    research: 7,
    color: '#6f625c',
    fact: 'Camadas de cinza registram erupções antigas dos vulcões de Tharsis e Elysium.',
  }),
  basalto: (from: number): Layer => ({
    id: 'basalto',
    name: 'basalto',
    from,
    to: MAX_DEPTH,
    hardness: 0.95,
    research: 6,
    color: '#4b4448',
    fact: 'Rocha vulcânica dura, a base da crosta marciana. Esquenta muito a broca.',
  }),
  organico: (from: number): Layer => ({
    id: 'organico',
    name: 'sedimento protegido',
    from,
    to: MAX_DEPTH,
    hardness: 0.65,
    research: 14,
    color: '#5d4a3a',
    fact: 'Abaixo de ~1,5 m a radiação não chega: é onde o ExoMars procura moléculas orgânicas.',
  }),
};

/** Perfil do subsolo de cada base (regiões reais). */
export const PROFILES: Record<string, Layer[]> = {
  jezero: [L.regolito(15), L.argila(15, 70), L.carbonato(70, 140), L.organico(140)],
  gale: [L.regolito(12), L.sulfato(12, 60), L.argila(60, 130), L.basalto(130)],
  utopia: [L.regolito(8), L.gelo(8, 90), L.argila(90, 150), L.basalto(150)],
  arcadia: [L.regolito(10), L.gelo(10, 110), L.basalto(110)],
  hellas: [L.regolito(15), L.gelo(15, 70), L.argila(70, 150), L.organico(150)],
  olympus: [L.regolito(10), L.cinza(10, 80), L.basalto(80)],
  elysium: [L.regolito(15), L.cinza(15, 90), L.argila(90, 140), L.basalto(140)],
  valles: [L.regolito(10), L.sulfato(10, 100), L.argila(100, 160), L.basalto(160)],
};

const FALLBACK_PROFILE: Layer[] = [L.regolito(MAX_DEPTH)];

export const profileFor = (baseId: string): Layer[] =>
  PROFILES[baseId] ?? PROFILES.jezero ?? FALLBACK_PROFILE;

/** Camada pelo id (ou a primeira abaixo da superfície, se o id não existir neste perfil). */
export function layerById(profile: readonly Layer[], id: string): Layer {
  return (
    profile.find((l) => l.id === id) ?? profile[1] ?? profile[0] ?? (FALLBACK_PROFILE[0] as Layer)
  );
}

export function layerAt(profile: readonly Layer[], depth: number): Layer {
  return profile.find((l) => depth >= l.from && depth < l.to) ?? profile[profile.length - 1]!;
}

/** Camada pedida pela ciência no Sol (nunca o regolito da superfície). */
export function targetLayer(baseId: string, seed: number, sol: number): Layer {
  const profile = profileFor(baseId);
  const deep = profile.filter((l) => l.id !== 'regolito');
  return deep[Math.floor(seeded(seed, sol, 17) * deep.length)] ?? profile[0]!;
}

export interface DrillState {
  depth: number;
  /** 0..1; em 1 a broca trava até esfriar */
  heat: number;
  jammed: boolean;
}

export const DRILL = {
  /** cm/s numa camada de dureza 0 (cai com a dureza) */
  speed: 34,
  /** aquecimento por segundo em dureza 1 */
  heatRate: 0.75,
  cooling: 0.45,
  /** volta a girar quando esfria até aqui */
  resume: 0.35,
} as const;

export const initialDrill = (): DrillState => ({ depth: 0, heat: 0, jammed: false });

/** Avança a sonda `dt` segundos (perfurando ou não). */
export function drillStep(
  s: DrillState,
  profile: readonly Layer[],
  drilling: boolean,
  dt: number,
): DrillState {
  const t = Math.max(0, Math.min(0.1, dt));
  if (s.jammed || !drilling || s.depth >= MAX_DEPTH) {
    const heat = Math.max(0, s.heat - DRILL.cooling * t);
    return { ...s, heat, jammed: s.jammed && heat > DRILL.resume };
  }
  const layer = layerAt(profile, s.depth);
  const depth = Math.min(MAX_DEPTH, s.depth + DRILL.speed * (1 - 0.7 * layer.hardness) * t);
  const heat = Math.min(1, s.heat + DRILL.heatRate * layer.hardness * t);
  return { depth, heat, jammed: heat >= 1 };
}

export interface SampleResult {
  layer: Layer;
  hit: boolean;
  research: number;
}

/** Coleta na profundidade atual: na camada pedida vale a pesquisa cheia (+ bônus no miolo). */
export function collectSample(
  depth: number,
  profile: readonly Layer[],
  target: Layer,
): SampleResult {
  const layer = layerAt(profile, depth);
  if (layer.id !== target.id) return { layer, hit: false, research: 2 };
  const mid = (layer.from + layer.to) / 2;
  const half = Math.max(1, (layer.to - layer.from) / 2);
  const centered = 1 - Math.min(1, Math.abs(depth - mid) / half);
  return { layer, hit: true, research: layer.research + Math.round(centered * 4) };
}
