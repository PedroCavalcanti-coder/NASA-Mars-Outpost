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

/** Dias sem entrar no mundo até o vínculo com o jogador expirar (sem vínculos o mundo é apagado). */
export const WORLD_LINK_DAYS = 30;
/** Intervalo do salvamento automático (ms). */
export const WORLD_AUTOSAVE_MS = 5 * 60_000;
/** Tamanho máximo do JSON de missão aceito num salvamento (bytes). */
export const WORLD_MISSION_MAX_BYTES = 12_000;
/** Apelido: tamanho e comparação (sem acento/caixa) usados no servidor e no cliente. */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 24;
export const normalizeNickname = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** O que fica gravado no banco (JSON) para retomar um mundo. */
export interface WorldSave {
  v: 1;
  /** tempo de jogo decorrido: o relógio retoma de onde parou */
  elapsedMs: number;
  solar: number[];
  crops: number[];
  vehicle?: GameVehicleState;
  /** estado da missão do ÚLTIMO jogador que salvou */
  mission?: unknown;
}

/** Um mundo na lista "recentes" do jogador. */
export interface RecentWorld {
  code: string;
  baseId: string;
  savedAt: string;
  lastSeenAt: string;
  nickname: string;
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
  persistence: {
    /** este jogador tem vínculo com o mundo (o salvamento automático fica ligado) */
    linked: boolean;
    /** há como salvar (cookie de chave aceito ou conta) */
    canSave: boolean;
    /** missão gravada pelo último jogador que salvou, se houver */
    mission?: unknown;
  };
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
  /** Grava o mundo no banco e vincula o jogador a ele. */
  'world:save': (
    payload: { mission?: unknown },
    ack: (r: GameAck<{ savedAt: number }>) => void,
  ) => void;
}
