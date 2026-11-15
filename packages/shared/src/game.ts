import type { SuitConfig } from './astronaut';
import type { DuoGestureId, GestureStart } from './gestures';

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

/** Opções adicionais para cálculo do relógio em tempo acelerado ou pausado. */
export interface GameClockOptions {
  /** Escala de velocidade (1 | 2 | 3). Padrão = 1 */
  scale?: 1 | 2 | 3;
  /** Se a simulação da sala está pausada */
  paused?: boolean;
  /** Instante (ms) da última alteração de velocidade/pausa */
  timeUpdatedAt?: number;
  /** Tempo virtual acumulado (ms) até a última alteração */
  virtualElapsedMs?: number;
}

/** Hora do dia (0..24) e Sol a partir do relógio compartilhado da sala. */
export function gameClock(clockStart: number, now: number, opts?: GameClockOptions) {
  // Âncora = último instante em que velocidade/pausa mudou (ou o início da sala).
  // Até a âncora vale o tempo virtual acumulado; dela em diante, o tempo real × escala.
  const anchor = opts?.timeUpdatedAt ?? clockStart;
  const baseElapsed = Math.max(0, opts?.virtualElapsedMs ?? anchor - clockStart);
  const scale = opts?.paused ? 0 : opts?.scale === 2 || opts?.scale === 3 ? opts.scale : 1;
  const elapsedMs = baseElapsed + Math.max(0, now - anchor) * scale;
  const hours = GAME_START_HOUR + (elapsedMs * 24) / (GAME_SOL_SECONDS * 1000);
  return { hour: hours % 24, sol: 1 + Math.floor(hours / 24), elapsedMs };
}

/** Velocidades aceitas do relógio da sala. */
export type GameTimeScale = 1 | 2 | 3;
/** Maior salto de tempo aceito num único pedido (ferramentas de teste): 1 Sol. */
export const GAME_TIME_MAX_ADVANCE_MS = GAME_SOL_SECONDS * 1000;

/** Estado do relógio compartilhado depois de uma mudança de pausa/velocidade. */
export interface GameTimeState {
  paused: boolean;
  scale: GameTimeScale;
  /** instante (ms, relógio do servidor) da mudança: âncora do cálculo */
  timeUpdatedAt: number;
  /** tempo de jogo acumulado até a âncora (ms) */
  virtualElapsedMs: number;
}

/** Pedido de mudança no relógio (só o coordenador pode, se houver mais de um jogador). */
export interface GameTimeRequest {
  paused: boolean;
  scale: GameTimeScale;
  /** avança o relógio nesta quantidade de ms (0..1 Sol) — usado pelas ações de teste */
  advanceMs?: number;
}

export const normalizeTimeScale = (s: unknown): GameTimeScale => (s === 2 || s === 3 ? s : 1);

/** Hora/Sol do mundo levando em conta pausa e velocidade. */
export function worldClock(world: GameWorldState, now: number) {
  return gameClock(world.clockStart, now, {
    paused: world.paused,
    scale: world.timeScale,
    timeUpdatedAt: world.timeUpdatedAt,
    virtualElapsedMs: world.virtualElapsedMs,
  });
}

/**
 * Aplica uma mudança de pausa/velocidade ao mundo (muta `world`) e devolve o estado novo.
 * O tempo já decorrido é "congelado" na âncora, então a hora nunca pula ao trocar de velocidade.
 */
export function applyTimeChange(
  world: GameWorldState,
  now: number,
  req: GameTimeRequest,
): GameTimeState {
  const advance = Number.isFinite(req.advanceMs)
    ? Math.max(0, Math.min(GAME_TIME_MAX_ADVANCE_MS, req.advanceMs ?? 0))
    : 0;
  const state: GameTimeState = {
    paused: req.paused === true,
    scale: normalizeTimeScale(req.scale),
    timeUpdatedAt: now,
    virtualElapsedMs: worldClock(world, now).elapsedMs + advance,
  };
  applyTimeState(world, state);
  return state;
}

/** Copia um estado de relógio recebido para o mundo local. */
export function applyTimeState(world: GameWorldState, t: GameTimeState): void {
  world.paused = t.paused;
  world.timeScale = t.scale;
  world.timeUpdatedAt = t.timeUpdatedAt;
  world.virtualElapsedMs = t.virtualElapsedMs;
}

/**
 * `drive`: o jogador dirige o rover; `ride`: é o passageiro do rover (o rover tem 2 lugares).
 * Nos dois casos x, z, h são os do veículo.
 */
/** Emojis do painel circular. O servidor só aceita estes (pelo índice), nunca texto livre. */
export const GAME_EMOTES = [
  '😀',
  '😂',
  '👍',
  '👋',
  '❤️',
  '😮',
  '🎉',
  '🚀',
  // gestos do Astronauta v2 (sempre no fim: o servidor valida pelo índice)
  '👎',
  '👏',
  '👉',
  '💃',
] as const;

export type GameMotionKind = 'idle' | 'walk' | 'clean' | 'plant' | 'harvest' | 'drive' | 'ride';

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

/**
 * Cuidados diários compartilhados pela sala: em que Sol cada canteiro e o filtro de ar foram
 * cuidados pela última vez (0 = nunca). Canteiro sem cuidado num Sol morre na virada do dia;
 * filtro sem troca num Sol fica entupido até ser limpo.
 */
export interface GameCareState {
  crops: number[];
  filter: number;
  /** Plantas que ainda precisam ser irrigadas nesta plantação. */
  needsCare?: boolean[];
}

/** Valida cuidados vindos da rede/banco: inteiros 0..100000, no máximo `GAME_MAX_CROPS` canteiros. */
export function normalizeCare(raw: unknown): GameCareState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const sol = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100_000, Math.round(v))) : 0;
  if (!Array.isArray(r.crops)) return null;
  return {
    crops: r.crops.slice(0, GAME_MAX_CROPS).map(sol),
    filter: sol(r.filter),
    ...(Array.isArray(r.needsCare)
      ? { needsCare: r.needsCare.slice(0, GAME_MAX_CROPS).map((v) => v === true) }
      : {}),
  };
}

/**
 * Quadro de missões da sala: quais missões de pesquisa já foram concluídas no Sol atual e em que
 * Sol a horta devolveu oxigênio pela última vez. O servidor guarda e não deixa duas pessoas
 * concluírem a mesma missão no mesmo Sol.
 */
export interface GameMissionBoard {
  sol: number;
  done: string[];
  garden: number;
}

export const GAME_BOARD_MAX_DONE = 12;

/** Valida o quadro vindo da rede/banco (ids curtos, no máximo `GAME_BOARD_MAX_DONE`). */
export function normalizeBoard(raw: unknown): GameMissionBoard | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const int = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100_000, Math.round(v))) : 0;
  const done = Array.isArray(r.done)
    ? r.done.filter((x): x is string => typeof x === 'string' && /^[a-z_]{1,24}$/.test(x))
    : [];
  return {
    sol: int(r.sol),
    done: [...new Set(done)].slice(0, GAME_BOARD_MAX_DONE),
    garden: int(r.garden),
  };
}

/** Chaves de variação aceitas num evento de missão (recursos, pesquisa e moral). */
export const GAME_MISSION_DELTA_KEYS = [
  'energy',
  'supplies',
  'materials',
  'oxygen',
  'research',
  'morale',
] as const;

/**
 * Missão concluída (ou bônus da horta): todos os jogadores aplicam o mesmo custo e a mesma
 * recompensa, então a base e os pontos de pesquisa ficam iguais para a sala inteira.
 */
export interface GameMissionEvent {
  /** id único do evento (evita aplicar duas vezes) */
  eid: string;
  /** id da missão (`soil_robot`, `drill`…) ou `garden` */
  id: string;
  sol: number;
  by: string;
  title: string;
  text: string;
  deltas: Record<string, number>;
}

/** Valida um evento de missão recebido: texto curto, deltas conhecidos e limitados. */
export function normalizeMissionEvent(raw: unknown): GameMissionEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.eid !== 'string' || !/^[\w-]{4,40}$/.test(r.eid)) return null;
  if (typeof r.id !== 'string' || !/^[a-z_]{1,24}$/.test(r.id)) return null;
  if (typeof r.sol !== 'number' || !Number.isFinite(r.sol) || r.sol < 1 || r.sol > 100_000)
    return null;
  const deltas: Record<string, number> = {};
  if (r.deltas && typeof r.deltas === 'object') {
    for (const key of GAME_MISSION_DELTA_KEYS) {
      const v = (r.deltas as Record<string, unknown>)[key];
      if (typeof v === 'number' && Number.isFinite(v) && v !== 0) {
        deltas[key] = Math.max(-60, Math.min(60, Math.round(v)));
      }
    }
  }
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    eid: r.eid,
    id: r.id,
    sol: Math.round(r.sol),
    by: text(r.by, 24),
    title: text(r.title, 60),
    text: text(r.text, 200),
    deltas,
  };
}

/**
 * Aplica um evento ao quadro: vira o Sol se preciso e recusa (`null`) missão repetida no mesmo Sol
 * ou evento de um Sol que já passou. A horta só rende uma vez por Sol.
 */
export function applyMissionEvent(
  board: GameMissionBoard | undefined,
  ev: GameMissionEvent,
): GameMissionBoard | null {
  const cur = board ?? { sol: ev.sol, done: [], garden: 0 };
  if (ev.sol < cur.sol) return null;
  const base: GameMissionBoard =
    ev.sol > cur.sol ? { sol: ev.sol, done: [], garden: cur.garden } : cur;
  if (ev.id === 'garden') {
    if (base.garden >= ev.sol) return null;
    return { ...base, garden: ev.sol };
  }
  if (base.done.includes(ev.id)) return null;
  return { ...base, done: [...base.done, ev.id].slice(-GAME_BOARD_MAX_DONE) };
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
  /** cuidados diários (horta e filtro de ar); ausente = ninguém cuidou ainda */
  care?: GameCareState;
  /** missões concluídas no Sol atual; ausente = nada feito ainda */
  board?: GameMissionBoard;
  /** relógio: velocidade, pausa e âncora (ver `worldClock`); ausentes = 1×, rodando desde `clockStart` */
  timeScale?: GameTimeScale;
  paused?: boolean;
  timeUpdatedAt?: number;
  virtualElapsedMs?: number;
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
  care?: GameCareState;
  board?: GameMissionBoard;
  /** velocidade e pausa do relógio quando o mundo foi salvo */
  timeScale?: GameTimeScale;
  paused?: boolean;
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
  'world:care': (c: GameCareState) => void;
  /** missão de pesquisa concluída por outro jogador (aplicar custo e recompensa) */
  'mission:event': (ev: GameMissionEvent) => void;
  'player:emote': (id: string, emote: number) => void;
  /** voto de alguém num evento da base */
  'event:vote': (id: string, eid: string, choice: number) => void;
  /** decisão final de um evento (todos aplicam a mesma opção e o mesmo sorteio de risco) */
  'event:result': (eid: string, choice: number, roll: number) => void;
  /** convite para um gesto em dupla, vindo de outro jogador (validado pelo servidor) */
  'gesture:invite': (fromId: string, gesture: DuoGestureId) => void;
  /** os dois jogadores executam o gesto agora */
  'gesture:start': (start: GestureStart) => void;
  /** convite recusado pelo servidor (longe demais, rover, sem alvo...) */
  'gesture:denied': (reason: string) => void;
  'player:chat': (id: string, message: string) => void;
  /** relógio mudou (pausa/velocidade/salto): vai para todos, inclusive quem pediu */
  'world:time': (t: GameTimeState) => void;
}

export interface GameClientToServer {
  'room:join': (req: GameJoinRequest, ack: (r: GameAck<GameJoinResult>) => void) => void;
  'player:state': (s: GameMotion) => void;
  'world:storm': (value: number) => void;
  'world:solar': (stages: number[]) => void;
  'world:crops': (stages: number[]) => void;
  'world:vehicle': (v: GameVehicleState) => void;
  'world:care': (c: GameCareState) => void;
  'mission:event': (ev: GameMissionEvent) => void;
  'player:emote': (emote: number) => void;
  'event:vote': (eid: string, choice: number) => void;
  'event:result': (eid: string, choice: number, roll: number) => void;
  'gesture:invite': (gesture: DuoGestureId, targetId: string) => void;
  'gesture:accept': (fromId: string) => void;
  'player:chat': (message: string) => void;
  /** pede mudança no relógio (restrita ao coordenador se houver mais de um jogador) */
  'world:time': (req: GameTimeRequest) => void;
  /** Grava o mundo no banco e vincula o jogador a ele. */
  'world:save': (
    payload: { mission?: unknown },
    ack: (r: GameAck<{ savedAt: number }>) => void,
  ) => void;
  /** Volta o mundo da sala ao último salvamento (só sozinho na sala). */
  'world:restore': (ack: (r: GameAck<{ restored: true }>) => void) => void;
}
