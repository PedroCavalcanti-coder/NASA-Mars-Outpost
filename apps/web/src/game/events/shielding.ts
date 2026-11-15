import type { EventDeltas } from './events';

/**
 * Blindagem da base (0–100): eventos a desgastam. Com a blindagem zerada, todo evento seguinte
 * cobra o DOBRO de energia, mantimentos e oxigênio. Reparar na bancada de ferramentas gasta materiais.
 */
export const SHIELD_REPAIR = {
  /** materiais gastos por reparo */
  materials: 8,
  /** pontos de blindagem devolvidos por reparo */
  gain: 20,
  /** reparos por Sol */
  perSol: 3,
} as const;

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
