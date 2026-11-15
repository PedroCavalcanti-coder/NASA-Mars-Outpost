/**
 * Decisão dos eventos em sala (funções puras):
 *  - 1 jogador: decide direto;
 *  - 2 jogadores: um deles é sorteado e decide (igual para todos);
 *  - 3 a 4 jogadores: votação de 30 s; vence a opção mais votada.
 */
import { seeded } from '../tasks/rules';

export const VOTE_SECONDS = 30;

export type DecisionMode = 'solo' | 'decider' | 'vote';

export const modeFor = (players: number): DecisionMode =>
  players <= 1 ? 'solo' : players === 2 ? 'decider' : 'vote';

/** Quem decide num evento de 2 jogadores: sorteio determinístico (mesma resposta em todos os clientes). */
export function pickDecider(ids: readonly string[], seed: number, sol: number): string | null {
  if (!ids.length) return null;
  const sorted = [...ids].sort();
  return sorted[Math.floor(seeded(seed, sol, 733) * sorted.length)] ?? sorted[0] ?? null;
}

/** Opção vencedora: a mais votada; empate resolvido por sorteio determinístico. Sem votos: a 1ª. */
export function tally(
  votes: Record<string, number>,
  choices: number,
  seed: number,
  sol: number,
): number {
  const counts = Array.from({ length: choices }, () => 0);
  for (const v of Object.values(votes))
    if (Number.isInteger(v) && v >= 0 && v < choices) counts[v]!++;
  const top = Math.max(...counts);
  const tied = counts.flatMap((c, i) => (c === top ? [i] : []));
  if (tied.length === 1 || top === 0) return tied[0] ?? 0;
  return tied[Math.floor(seeded(seed, sol, 741) * tied.length)] ?? tied[0] ?? 0;
}
