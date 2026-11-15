import { create } from 'zustand';
import type { GameEventDef } from './events';

interface GameEventsStore {
  /** fila de eventos esperando o jogador (o primeiro é o que o tablet mostra) */
  queue: GameEventDef[];
  push: (events: GameEventDef[]) => void;
  /** tira o evento da frente da fila */
  shift: () => void;
  clear: () => void;
}

export const useGameEvents = create<GameEventsStore>((set) => ({
  queue: [],
  push: (events) =>
    set((s) => ({
      queue: [...s.queue, ...events.filter((e) => !s.queue.some((q) => q.id === e.id))],
    })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
  clear: () => set({ queue: [] }),
}));
