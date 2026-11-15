import { ACTIONS_PER_SOL, INITIAL, LOG_LIMIT, RESEARCH_GOAL } from './balance';
import type { Crisis, DeltaKey, Deltas, LogEntry, MissionState, ResourceId } from './types';

export const RESOURCE_IDS: readonly ResourceId[] = ['energy', 'supplies', 'armor', 'oxygen'];

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
      armor: { ...INITIAL.resources.armor },
    },
    facilities: { ...INITIAL.facilities },
    solarEfficiency: 1,
    morale: INITIAL.morale,
    research: 0,
    secured: 0,
    status: 'playing',
    lossReason: null,
    log: [],
    nextLogId: 1,
  };
}

/** Salvamentos antigos: completa o que falta (dados enviados) e converte a blindagem antiga em armor. */
export function ensureShielding(s: MissionState): MissionState {
  const legacy = (
    s.resources as unknown as Record<string, { value: number; max: number } | undefined>
  ).shielding;
  const next: MissionState = typeof s.secured === 'number' ? s : { ...s, secured: 0 };
  if (next.resources.armor) return next;
  return {
    ...next,
    resources: { ...next.resources, armor: { ...(legacy ?? INITIAL.resources.armor) } },
  };
}

/** Cópia profunda (a simulação nunca altera o estado recebido). */
export function cloneState(s: MissionState): MissionState {
  return {
    ...s,
    resources: {
      oxygen: { ...s.resources.oxygen },
      energy: { ...s.resources.energy },
      supplies: { ...s.resources.supplies },
      armor: { ...s.resources.armor },
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
  // dados já enviados à Terra nunca se perdem: a pesquisa não cai abaixo do que está protegido
  if (key === 'research')
    s.research = clamp(value, Math.min(s.secured ?? 0, s.researchGoal ?? RESEARCH_GOAL), s.researchGoal ?? RESEARCH_GOAL);
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
  if (s.resources.armor.value <= 0) list.push('structural');
  return list;
}

/** Base operacional: com energia e mantimentos. Só assim a vitória é confirmada. */
export function isOperational(s: MissionState): boolean {
  return (
    s.resources.energy.value > 0 && s.resources.supplies.value > 0 && s.resources.armor.value > 0
  );
}

export function pushLog(s: MissionState, entry: Omit<LogEntry, 'id' | 'sol'>): LogEntry {
  const full: LogEntry = { id: s.nextLogId++, sol: s.sol, ...entry };
  s.log = [full, ...s.log].slice(0, LOG_LIMIT);
  return full;
}

/** Migration of legacy JSON missions: materials are deliberately discarded. */
export function migrateMission(raw: unknown): MissionState {
  const initial = createMission();
  if (!raw || typeof raw !== 'object') return initial;
  const old = raw as MissionState;
  const state = { ...initial, ...old, resources: { ...initial.resources } };
  for (const id of RESOURCE_IDS) {
    const r = old.resources?.[id];
    if (r && Number.isFinite(r.value) && Number.isFinite(r.max) && r.max > 0)
      state.resources[id] = { value: clamp(r.value, 0, r.max), max: r.max };
  }
  state.resources.armor = { value: old.resources?.armor?.value ?? 100, max: 100 };
  state.log = Array.isArray(old.log)
    ? old.log.map((entry) => ({
        ...entry,
        deltas: Object.fromEntries(
          Object.entries(entry.deltas ?? {}).filter(([k]) => k !== 'materials'),
        ),
      }))
    : [];
  return state;
}
