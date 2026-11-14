import { DEFAULT_SUIT, normalizeSuit, type SuitConfig } from '@mars/shared';

const KEY = 'mars_astronaut_suit_v1';

export function readSuitPreference(): SuitConfig {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeSuit(JSON.parse(raw)) : { ...DEFAULT_SUIT };
  } catch {
    return { ...DEFAULT_SUIT };
  }
}

export function saveSuitPreference(suit: SuitConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(suit));
  } catch {
    /* Gravação local segura */
  }
}
