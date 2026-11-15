import {
  type Command,
  createMission,
  type Deltas,
  diffState,
  type LogEntry,
  type MissionState,
  runCommand,
  triggerEvent,
} from '@mars/sim';
import { create } from 'zustand';

interface MissionStore {
  state: MissionState;
  /** variação total do último comando; `key` muda a cada comando para reanimar a HUD */
  feedback: { key: number; deltas: Deltas; reward?: boolean } | null;
  /** registros do último comando (para destacar eventos do fim do sol) */
  lastEntries: LogEntry[];
  error: string | null;
  start: (seed?: number) => void;
  run: (cmd: Command) => void;
  triggerEvent: (id: string) => void;
}

let feedbackKey = 0;

/** Partida local (um jogador). A lógica toda está em @mars/sim; aqui só guardamos o estado. */
export const useMission = create<MissionStore>((set, get) => ({
  state: createMission(),
  feedback: null,
  lastEntries: [],
  error: null,
  start: (seed) =>
    set({
      state: createMission(seed ?? Math.floor(Math.random() * 2 ** 32)),
      feedback: null,
      lastEntries: [],
      error: null,
    }),
  triggerEvent: (id) => {
    const prev = get().state;
    if (prev.status !== 'playing') return set({ error: 'Missão encerrada' });
    const result = triggerEvent(prev, id);
    if (!result) return set({ error: 'Evento desconhecido' });
    set({
      state: result.state,
      lastEntries: [result.entry],
      error: null,
      feedback: { key: ++feedbackKey, deltas: diffState(prev, result.state) },
    });
  },
  run: (cmd) => {
    const prev = get().state;
    const { state, entries, error } = runCommand(prev, cmd);
    if (error) return set({ error });
    set({
      state,
      lastEntries: entries,
      error: null,
      feedback: { key: ++feedbackKey, deltas: diffState(prev, state), reward: cmd.type === 'reward' },
    });
  },
}));
