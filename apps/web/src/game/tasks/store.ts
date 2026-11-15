import { useMemo } from 'react';
import { create } from 'zustand';
import { buildTasks, type DailyTask } from './rules';

/**
 * Estado da operação da base que a HUD mostra (tarefas do Sol, painéis, rede elétrica).
 * Quem escreve é o `BaseViewer` (algumas vezes por segundo, só quando algo muda).
 */
export interface BaseOpsState {
  active: boolean;
  sol: number;
  seed: number;
  baseId: string;
  panelStages: number[];
  panelsCleanedToday: number[];
  cropStages: number[];
  cropNames: string[];
  cropCare: number[];
  cropNeedsCare: boolean[];
  filterSol: number;
  filterClogged: boolean;
  drillDoneSol: number;
  drillTarget: string;
  /** unidades por Sol (para exibir) */
  generationPerSol: number;
  loadPerSol: number;
  battery: number;
  capacity: number;
  blackout: boolean;
  oxygenProducing: boolean;
}

export const initialOps: BaseOpsState = {
  active: false,
  sol: 1,
  seed: 0,
  baseId: '',
  panelStages: [],
  panelsCleanedToday: [],
  cropStages: [],
  cropNames: [],
  cropCare: [],
  cropNeedsCare: [],
  filterSol: 0,
  filterClogged: false,
  drillDoneSol: 0,
  drillTarget: '',
  generationPerSol: 0,
  loadPerSol: 0,
  battery: 0,
  capacity: 1,
  blackout: false,
  oxygenProducing: true,
};

export const useBaseOps = create<BaseOpsState>(() => ({ ...initialOps }));

/** Publica só os campos que mudaram (evita re-renderizar a HUD a cada quadro). */
export function publishOps(next: Partial<BaseOpsState>): void {
  const cur = useBaseOps.getState();
  const patch: Partial<BaseOpsState> = {};
  let changed = false;
  for (const [k, v] of Object.entries(next) as [keyof BaseOpsState, unknown][]) {
    const before = cur[k];
    const same = Array.isArray(v)
      ? Array.isArray(before) &&
        before.length === v.length &&
        before.every((x, i) => x === (v as unknown[])[i])
      : before === v;
    if (!same) {
      (patch as Record<string, unknown>)[k] = v;
      changed = true;
    }
  }
  if (changed) useBaseOps.setState(patch);
}

export const resetOps = () => useBaseOps.setState({ ...initialOps });

export function tasksFrom(s: BaseOpsState): DailyTask[] {
  if (!s.active) return [];
  return buildTasks({
    sol: s.sol,
    seed: s.seed,
    panelStages: s.panelStages,
    panelsCleanedToday: s.panelsCleanedToday,
    cropStages: s.cropStages,
    cropNames: s.cropNames,
    cropCare: s.cropCare,
    cropNeedsCare: s.cropNeedsCare,
    filterSol: s.filterSol,
    drillDoneSol: s.drillDoneSol,
    drillTarget: s.drillTarget,
  });
}

/** Tarefas do Sol atual (recalculadas só quando os dados delas mudam). */
export function useDailyTasks(): DailyTask[] {
  const s = useBaseOps();
  // biome-ignore lint/correctness/useExhaustiveDependencies: só os campos que entram nas tarefas
  return useMemo(
    () => tasksFrom(s),
    [
      s.active,
      s.sol,
      s.seed,
      s.panelStages,
      s.panelsCleanedToday,
      s.cropStages,
      s.cropCare,
      s.cropNeedsCare,
      s.filterSol,
      s.drillDoneSol,
      s.drillTarget,
    ],
  );
}
