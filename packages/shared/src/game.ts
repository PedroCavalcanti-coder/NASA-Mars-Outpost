import type { SuitConfig } from './astronaut';

/** Namespace Socket.IO das salas de jogo (aceita convidados, sem login). */
export const GAME_NAMESPACE = '/game';
export const GAME_MAX_PLAYERS = 4;
/** Código de sala: letras maiúsculas, números, `-` e `_` (3 a 40 caracteres). */
export const GAME_ROOM_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
/** Hora do dia (LMST) em que uma sala nova começa e duração de um Sol em segundos reais. */
export const GAME_START_HOUR = 9;
export const GAME_SOL_SECONDS = 600;
/** Quantidade de painéis solares sincronizados (máx. entre as bases). */
export const GAME_MAX_SOLAR = 32;
/** Quantidade de canteiros sincronizados. */
export const GAME_MAX_CROPS = 64;

/** Hora do dia (0..24) e Sol a partir do relógio compartilhado da sala. */
export function gameClock(clockStart: number, now: number) {
  const elapsed = Math.max(0, (now - clockStart) / 1000);
  const hours = GAME_START_HOUR + (elapsed * 24) / GAME_SOL_SECONDS;
  return { hour: hours % 24, sol: 1 + Math.floor(hours / 24) };
}

/** `drive`: o jogador está dentro do rover (x, z, h passam a ser os do veículo). */
/** Emojis do painel circular. O servidor só aceita estes (pelo índice), nunca texto livre. */
export const GAME_EMOTES = ['😀', '😂', '👍', '👋', '❤️', '😮', '🎉', '🚀'] as const;

export type GameMotionKind = 'idle' | 'walk' | 'clean' | 'plant' | 'harvest' | 'drive';

/** Estado que cada jogador envia sobre si mesmo (~10 vezes por segundo quando se mexe). */
export interface GameMotion {
  x: number;
  z: number;
  /** direção (rad) */
  h: number;
  m: GameMotionKind;
}

export interface GamePlayerInfo {
  id: string;
  name: string;
  suit: SuitConfig;
  /** 0..3: define o ponto de chegada na plataforma e quem coordena a poeira dos painéis */
  slot: number;
}

export interface GamePlayerState extends GamePlayerInfo {
  /** último estado conhecido (ausente se a pessoa acabou de entrar) */
  motion?: GameMotion;
}

/** Posição de descanso do rover (quando ninguém o dirige). */
export interface GameVehicleState {
  x: number;
  z: number;
  h: number;
}

/** Estado compartilhado do mundo: todos veem o mesmo relógio, tempestade, painéis, canteiros e rover. */
export interface GameWorldState {
  /** instante (ms, relógio do servidor) em que a sala estava às `GAME_START_HOUR` do Sol 1 */
  clockStart: number;
  storm: number;
  solar: number[];
  /** estágio de cada canteiro (0 vazio … 3 pronto); vazio = ainda não mexeram (vale o padrão do modelo) */
  crops: number[];
  /** onde o rover está parado; ausente = ponto de partida da base */
  vehicle?: GameVehicleState;
}

export type GameAck<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface GameJoinRequest {
  code: string;
  name: string;
  suit: SuitConfig;
  base: string;
}

export interface GameJoinResult {
  self: GamePlayerInfo;
  players: GamePlayerState[];
  world: GameWorldState;
  serverNow: number;
}

export interface GameServerToClient {
  'player:joined': (p: GamePlayerInfo) => void;
  'player:left': (id: string) => void;
  'player:state': (id: string, s: GameMotion) => void;
  'world:storm': (value: number) => void;
  'world:solar': (stages: number[]) => void;
  'world:crops': (stages: number[]) => void;
  'world:vehicle': (v: GameVehicleState) => void;
  'player:emote': (id: string, emote: number) => void;
}

export interface GameClientToServer {
  'room:join': (req: GameJoinRequest, ack: (r: GameAck<GameJoinResult>) => void) => void;
  'player:state': (s: GameMotion) => void;
  'world:storm': (value: number) => void;
  'world:solar': (stages: number[]) => void;
  'world:crops': (stages: number[]) => void;
  'world:vehicle': (v: GameVehicleState) => void;
  'player:emote': (emote: number) => void;
}
