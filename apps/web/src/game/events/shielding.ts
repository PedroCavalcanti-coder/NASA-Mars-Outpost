import type { EventDeltas } from './events';

/**
 * Blindagem da base (armor, 0–100): vem das fraturas do casco (a branch da blindagem). Eventos a
 * desgastam; com ela zerada, todo evento seguinte cobra o DOBRO de energia, mantimentos e oxigênio.
 * O reparo é feito nas fraturas, no minigame de reparo.
 */

const DOUBLED = ['energy', 'supplies', 'oxygen'] as const;

/** Aplica o dobro de penalidade (só perdas de energia, mantimentos e oxigênio) com blindagem zerada. */
export function scaleDamage(
  deltas: EventDeltas | undefined,
  shielding: number,
): EventDeltas | undefined {
  if (!deltas || shielding > 0) return deltas;
  const out: EventDeltas = { ...deltas };
  for (const k of DOUBLED) {
    const v = out[k];
    if (typeof v === 'number' && v < 0) out[k] = v * 2;
  }
  return out;
}

/** Não deixa passar do que existe: a blindagem fica em 0..100. */
export const shieldLabel = (value: number) =>
  value <= 0 ? 'Zerada: eventos custam o dobro' : value < 40 ? 'Baixa' : 'Estável';
