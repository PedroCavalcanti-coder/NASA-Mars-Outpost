import { ACTIONS_PER_SOL, INITIAL, LOG_LIMIT, RESEARCH_GOAL } from './balance';
import type { Crisis, DeltaKey, Deltas, LogEntry, MissionState, ResourceId } from './types';

export const RESOURCE_IDS: readonly ResourceId[] = [
  'energy',
  'supplies',
  'materials',
  'oxygen',
  'shielding',
];

export function createMission(seed: number = Date.now()): MissionState {
  const s = seed >>> 0;
  return {
    seed: s,
    rng: s,
    sol: 1,
    actionsLeft: ACTIONS_PER_SOL,
    resources: {
      oxygen: { ...INITIAL.resources.oxygen },
      energy: { ...INITIAL.resources.energy },
      supplies: { ...INITIAL.resources.supplies },
      materials: { ...INITIAL.resources.materials },
      shielding: { ...INITIAL.resources.shielding },
    },
    facilities: { ...INITIAL.facilities },
    solarEfficiency: 1,
    morale: INITIAL.morale,
    research: 0,
    status: 'playing',
    lossReason: null,
    log: [],
    nextLogId: 1,
  };
}

/** Salvamentos antigos não têm blindagem: completa com o valor inicial. */
export function ensureShielding(s: MissionState): MissionState {
  if (s.resources.shielding) return s;
  return { ...s, resources: { ...s.resources, shielding: { ...INITIAL.resources.shielding } } };
}

/** Cópia profunda (a simulação nunca altera o estado recebido). */
export function cloneState(s: MissionState): MissionState {
  return {
    ...s,
    resources: {
      oxygen: { ...s.resources.oxygen },
      energy: { ...s.resources.energy },
      supplies: { ...s.resources.supplies },
      materials: { ...s.resources.materials },
      shielding: { ...s.resources.shielding },
    },
    facilities: { ...s.facilities },
    log: [...s.log],
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function read(s: MissionState, key: DeltaKey): number {
  if (key === 'research') return s.research;
  if (key === 'morale') return s.morale;
  return s.resources[key].value;
}

function write(s: MissionState, key: DeltaKey, value: number) {
  if (key === 'research') s.research = clamp(value, 0, RESEARCH_GOAL);
  else if (key === 'morale') s.morale = clamp(value, 0, 100);
  else s.resources[key].value = clamp(value, 0, s.resources[key].max);
}

/**
 * Aplica variações respeitando os limites (nunca abaixo de 0 nem acima do máximo).
 * Devolve o que de fato mudou, que é o que a HUD mostra.
 */
export function change(s: MissionState, deltas: Deltas, into: Deltas = {}): Deltas {
  for (const [key, delta] of Object.entries(deltas) as [DeltaKey, number][]) {
    if (!delta) continue;
    const before = read(s, key);
    write(s, key, before + delta);
    const applied = read(s, key) - before;
    if (applied) into[key] = (into[key] ?? 0) + applied;
  }
  return into;
}

export function crises(s: MissionState): Crisis[] {
  const list: Crisis[] = [];
  if (s.resources.energy.value <= 0) list.push('blackout');
  if (s.resources.supplies.value <= 0) list.push('famine');
  if (s.resources.materials.value <= 0) list.push('shortage');
  return list;
}

/** Base operacional: com energia e mantimentos. Só assim a vitória é confirmada. */
export function isOperational(s: MissionState): boolean {
  return s.resources.energy.value > 0 && s.resources.supplies.value > 0;
}

export function pushLog(s: MissionState, entry: Omit<LogEntry, 'id' | 'sol'>): LogEntry {
  const full: LogEntry = { id: s.nextLogId++, sol: s.sol, ...entry };
  s.log = [full, ...s.log].slice(0, LOG_LIMIT);
  return full;
}
