import { create } from 'zustand';
import type { EventOutcome, GameEventDef } from './events';
import type { DecisionMode } from './voting';

/** Como o evento aberto está sendo decidido (e o que já foi decidido). */
export interface EventSession {
  /** id único do evento neste Sol */
  eid: string;
  mode: DecisionMode;
  selfId: string;
  deciderId: string | null;
  deciderName: string;
  voters: { id: string; name: string }[];
  votes: Record<string, number>;
  /** instante (ms) em que a votação fecha */
  deadline: number;
  result: { choice: number; outcome: EventOutcome } | null;
  /** explosão solar real (arquivo do DONKI) ligada ao evento de radiação */
  flare?: { classType: string; peak: string; region: number; note: string };
}

interface GameEventsStore {
  dismissed: string[];
  /** fila de eventos esperando a base (o primeiro é o que o tablet mostra) */
  queue: GameEventDef[];
  session: EventSession | null;
  push: (events: GameEventDef[]) => void;
  /** tira o evento da frente da fila */
  shift: () => void;
  clear: () => void;
  setSession: (s: EventSession | null) => void;
  addVote: (id: string, choice: number) => void;
  setResult: (r: EventSession['result']) => void;
}

export const useGameEvents = create<GameEventsStore>((set) => ({
  dismissed: [],
  queue: [],
  session: null,
  push: (events) =>
    set((s) => ({
      queue: [...s.queue, ...events.filter((e) => !s.queue.some((q) => q.id === e.id))],
    })),
  shift: () => set((s) => ({ queue: s.queue.slice(1), session: null })),
  clear: () => set({ queue: [], session: null }),
  setSession: (session) => set({ session }),
  addVote: (id, choice) =>
    set((s) =>
      s.session ? { session: { ...s.session, votes: { ...s.session.votes, [id]: choice } } } : s,
    ),
  setResult: (result) => set((s) => (s.session ? { session: { ...s.session, result } } : s)),
}));
