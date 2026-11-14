/** Simulação do jogo (roda igual no servidor e no navegador): pura, determinística e testável. */
import { GAME_NAME } from '@mars/shared';

export * from './balance';
export * from './engine';
export { EVENTS } from './events';
export { createMission, crises, isOperational, RESOURCE_IDS } from './state';
export * from './types';

export const SIM_VERSION = 1;

export function describeSim() {
  return `${GAME_NAME}: simulação v${SIM_VERSION}`;
}
