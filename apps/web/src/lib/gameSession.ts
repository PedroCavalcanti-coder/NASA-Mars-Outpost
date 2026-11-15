/**
 * Partida em andamento nesta aba (sessionStorage). Serve para:
 *  - recarregar a página dentro do jogo e voltar para o MESMO mundo (mesma sala e mesma base);
 *  - impedir que digitar `/jogar` na barra de endereço abra o jogo sem ter passado pelo início.
 * Nada daqui vai ao servidor; o salvamento de verdade continua sendo o do mundo.
 */

const PLAY_KEY = 'mo_play';
const MISSION_KEY = 'mo_mission';

export interface PlaySession {
  room: string;
  base?: string;
  /** código sorteado e ainda não confirmado pelo servidor (pode colidir com outro mundo) */
  fresh?: boolean;
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* navegação privada sem armazenamento: o jogo só não sobrevive ao recarregar */
  }
}

export function getPlaySession(): PlaySession | null {
  const raw = read(PLAY_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PlaySession>;
    if (typeof v.room === 'string' && v.room) {
      return {
        room: v.room,
        base: typeof v.base === 'string' ? v.base : undefined,
        fresh: v.fresh === true,
      };
    }
  } catch {
    /* valor corrompido: ignora */
  }
  return null;
}

export function savePlaySession(s: PlaySession) {
  write(PLAY_KEY, JSON.stringify(s));
}

/** Chamado ao sair do jogo ou ao começar uma partida nova (nunca reaproveita a anterior). */
export function clearPlaySession() {
  write(PLAY_KEY, null);
  write(MISSION_KEY, null);
}

export function clearMissionSnapshot() {
  write(MISSION_KEY, null);
}
