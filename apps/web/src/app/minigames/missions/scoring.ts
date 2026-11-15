/** Regras puras dos minigames de missão (testáveis sem DOM). */

/** Posição (0..1) do cursor que vai e volta numa barra, no tempo `t` (s) com `period` por ida. */
export function pingPong(t: number, period: number): number {
  const p = (((t / period) % 2) + 2) % 2;
  return p <= 1 ? p : 2 - p;
}

/** Zona verde: centro sorteado em [0.2, 0.8] e largura que encolhe um pouco a cada rodada. */
export function zoneFor(round: number, roll: number): { center: number; half: number } {
  const half = Math.max(0.1, 0.17 - round * 0.015);
  return { center: 0.2 + roll * 0.6, half };
}

export const inZone = (pos: number, z: { center: number; half: number }) =>
  Math.abs(pos - z.center) <= z.half;

/** Nota 0..1 pelo número de acertos (a missão sempre termina; quem erra ganha menos). */
export const stationQuality = (hits: number, rounds: number) =>
  rounds <= 0 ? 0 : Math.max(0, Math.min(1, hits / rounds));

/** Nota da coleta de solo: cada amostra vale mais quanto mais rápido foi colhida. */
export function soilQuality(times: readonly number[], goodMs = 2500, slowMs = 7000): number {
  if (!times.length) return 0;
  const score = times.map((ms) => {
    if (ms <= goodMs) return 1;
    if (ms >= slowMs) return 0.35;
    return 1 - ((ms - goodMs) / (slowMs - goodMs)) * 0.65;
  });
  return score.reduce((a, b) => a + b, 0) / score.length;
}
