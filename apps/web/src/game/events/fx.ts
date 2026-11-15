import { create } from 'zustand';
import type { GameEventDef } from './events';

type Fx = NonNullable<GameEventDef['fx']>;

/** Efeito visual de tela do evento em andamento (ver `EventFx`). */
export const useEventFx = create<{ fx: Fx | null; key: number }>(() => ({ fx: null, key: 0 }));

let timer: ReturnType<typeof setTimeout> | undefined;

export function startEventFx(fx: Fx | undefined, ms = 14000) {
  clearTimeout(timer);
  if (!fx) return useEventFx.setState({ fx: null });
  useEventFx.setState((s) => ({ fx, key: s.key + 1 }));
  timer = setTimeout(() => useEventFx.setState({ fx: null }), ms);
}
