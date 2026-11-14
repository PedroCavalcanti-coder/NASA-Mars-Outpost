const KEY = 'mo_guest_name';

/** Apelido de quem joga sem conta. Fica só na aba do navegador (sessionStorage), nunca vai ao servidor. */
export function saveGuestName(name: string) {
  try {
    sessionStorage.setItem(KEY, name.trim());
  } catch {
    /* navegação privada sem armazenamento: o jogo pede o apelido de novo */
  }
}

export function getGuestName(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
