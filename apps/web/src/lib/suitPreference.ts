import { cloneSuit, DEFAULT_SUIT, normalizeSuit, type SuitConfig } from '@mars/shared';

const KEY = 'mars_astronaut_suit_v2';

/**
 * Traje escolhido para o PRÓXIMO mundo (só nesta aba). O traje de verdade pertence ao jogador
 * naquele mundo e fica guardado no servidor; um jogo novo sempre começa com um personagem novo.
 */
export function readSuitPreference(): SuitConfig {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? normalizeSuit(JSON.parse(raw)) : cloneSuit(DEFAULT_SUIT);
  } catch {
    return cloneSuit(DEFAULT_SUIT);
  }
}

export function saveSuitPreference(suit: SuitConfig) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(suit));
  } catch {
    /* sem armazenamento: o traje vale só até recarregar */
  }
}

/** Jogo novo: descarta o traje anterior. */
export function clearSuitPreference() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
