/** Simulação do jogo (roda igual no servidor e no navegador). Ainda vazia: começamos agora. */
import { GAME_NAME } from '@mars/shared';

export const SIM_VERSION = 0;

export function describeSim() {
  return `${GAME_NAME}: simulação v${SIM_VERSION}`;
}
