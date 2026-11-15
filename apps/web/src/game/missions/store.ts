import { create } from 'zustand';
import type { MissionId, MissionSite } from './rules';

/** Fases da coleta de solo com o rover. */
export type SoilPhase = 'idle' | 'out' | 'sampling' | 'back' | 'deliver';

export interface MissionSiteView {
  label: string;
  x: number;
  z: number;
}

/**
 * Missões do Sol que a HUD mostra. Quem escreve é o `BaseViewer` (só quando algo muda):
 * ele sabe o Sol, o sorteio, o que a sala já concluiu e onde cada estação fica.
 */
export interface MissionBoardView {
  active: boolean;
  sol: number;
  /** missões sorteadas para hoje, na ordem de exibição */
  ids: MissionId[];
  /** concluídas hoje por qualquer jogador da sala */
  done: string[];
  night: number;
  blackout: boolean;
  /** onde fica cada estação (posição no mundo) */
  sites: Partial<Record<MissionSite, MissionSiteView>>;
  player: { x: number; z: number };
  /** amostras de solo que o jogador carrega até o computador */
  carrying: number;
  soilPhase: SoilPhase;
  /** véu de poeira sobre a tela enquanto o rover some na tempestade (0..1) */
  veil: number;
  garden: { planted: number; cared: number; bonusDone: boolean };
  /** mostrar os marcadores 3D das estações */
  beacons: boolean;
}

export const initialMissionBoard: MissionBoardView = {
  active: false,
  sol: 1,
  ids: [],
  done: [],
  night: 0,
  blackout: false,
  sites: {},
  player: { x: 0, z: 0 },
  carrying: 0,
  soilPhase: 'idle',
  veil: 0,
  garden: { planted: 0, cared: 0, bonusDone: false },
  beacons: true,
};

export const useMissionBoard = create<MissionBoardView>(() => ({ ...initialMissionBoard }));

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
};

/** Publica só os campos que mudaram (evita re-renderizar a HUD a cada quadro). */
export function publishMissionBoard(next: Partial<MissionBoardView>): void {
  const cur = useMissionBoard.getState();
  const patch: Record<string, unknown> = {};
  let changed = false;
  for (const [k, v] of Object.entries(next)) {
    if (!sameValue((cur as unknown as Record<string, unknown>)[k], v)) {
      patch[k] = v;
      changed = true;
    }
  }
  if (changed) useMissionBoard.setState(patch as Partial<MissionBoardView>);
}

export const resetMissionBoard = () => useMissionBoard.setState({ ...initialMissionBoard });
