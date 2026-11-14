import type { MissionState } from './types';

/** Mulberry32: rápido e determinístico. Mesma semente + mesmos comandos = mesma partida. */
export function random(s: MissionState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Inteiro aleatório em [min, max]. */
export function randomInt(s: MissionState, min: number, max: number): number {
  return min + Math.floor(random(s) * (max - min + 1));
}

export function pickWeighted<T extends { weight: number }>(
  s: MissionState,
  items: readonly T[],
): T {
  const total = items.reduce((n, i) => n + i.weight, 0);
  let roll = random(s) * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1] as T;
}
