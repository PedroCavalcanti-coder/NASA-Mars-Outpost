import { cloneState, pushLog } from './state';

export { BASE_EVENTS as EVENTS } from '@mars/shared';
/** O painel de desenvolvimento envia eventos ao controlador compartilhado. */
export function triggerEvent(previous: import('./types').MissionState, id: string) {
  const state = cloneState(previous);
  const entry = pushLog(state, { tone: 'info', title: 'Evento do mundo', text: id, deltas: {} });
  return { state, entry };
}
