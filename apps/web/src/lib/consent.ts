import { api } from '../net/api';

const KEY = 'mo_cookie_consent';
export type Consent = 'yes' | 'no' | null;

/** Escolha do visitante sobre o cookie de salvamento (fica só neste navegador). */
export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'yes' || v === 'no' ? v : null;
  } catch {
    return null;
  }
}

/**
 * `yes`: o servidor entrega um cookie HttpOnly com uma chave aleatória; é ela que liga este
 * navegador aos mundos salvos. `no`: a chave é apagada (dá para jogar, mas não para salvar).
 */
export async function setConsent(value: 'yes' | 'no'): Promise<boolean> {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* sem armazenamento: a escolha vale só para esta visita */
  }
  try {
    await api(`/worlds/consent`, { method: value === 'yes' ? 'POST' : 'DELETE' });
    return true;
  } catch {
    return false;
  }
}

/** Renova a validade do cookie uma vez por visita (quem aceitou antes continua vinculado). */
let renewed = false;
export function renewConsent() {
  if (renewed || getConsent() !== 'yes') return;
  renewed = true;
  void api('/worlds/consent', { method: 'POST' }).catch(() => {});
}
