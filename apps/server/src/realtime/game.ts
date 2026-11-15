import { applyDifficulty, createWorldSave } from '@mars/sim';
import { GAMEPLAY_VERSION, GAME_STEP_MS, GAME_PUBLISH_MS, type GameConfirmation } from '@mars/shared';
import { RoomSimulation } from './simulation';
import { MOVEMENT_VERSION, NAVIGATION_HASH, MOVEMENT_DT } from '@mars/shared';
import { RoomMovement } from './movement';
import {
  applyMissionEvent,
  applyTimeChange,
  GAME_EMOTES,
  GAME_MAX_CROPS,
  GAME_MAX_PLAYERS,
  GAME_MAX_SOLAR,
  GAME_NAMESPACE,
  GAME_ROOM_CODE_RE,
  type GameClientToServer,
  type GameMotion,
  type GamePlayerInfo,
  type GameServerToClient,
  type GameTimeState,
  type GameWorldState,
  NICKNAME_MAX,
  NICKNAME_MIN,
  newIntegrity,
  normalizeBoard,
  normalizeCare,
  normalizeMissionEvent,
  normalizeNickname,
  normalizeSuit,
  normalizeTimeScale,
  REPAIR_ANCHORS,
  hasProfanity,
  PROFANITY_MESSAGE,
  PROFANITY_NICK_MESSAGE,
  isDifficulty,
  type Difficulty,
  repairIntent,
  restoreIntegrity,
  tickIntegrity,
  type WorldSave,
  worldClock,
} from '@mars/shared';
import type { Namespace } from 'socket.io';
import {
  loadWorld,
  playerFromCookies,
  purgeExpired,
  sanitizeSave,
  saveWorld,
  linkSuit,
  touchLink,
} from '../worlds/service';
import { GestureBroker } from './gestures';

/**
 * Salas de jogo (até 4 astronautas por sala): relé em memória.
 * Não exige login (o jogo aceita convidados), então TUDO que chega é validado e limitado:
 * formato do código, tamanho do apelido, números finitos e taxa de mensagens por conexão.
 */

interface SocketData {
  room?: string;
  gameTokens: number; gameAt: number; actionAt: number; resyncAt: number; needsGameplaySnapshot?: boolean;
  joining?: boolean;
  motionTokens: number;
  motionRefillAt: number;
  info?: GamePlayerInfo;
  /** balde de fichas: evita inundar a sala com mensagens */
  tokens: number;
  lastEmote?: number;
  /** dono dos vínculos (conta ou chave do cookie); null = só joga, não salva */
  owner?: string | null;
  linked?: boolean;
  refillAt: number;
}

interface Room {
  code: string;
  simulation: RoomSimulation;
  movement: RoomMovement;
  players: Map<
    string,
    {
      info: GamePlayerInfo;
      motion?: GameMotion;
      resumeToken?: string;
      /** jogador do cookie (o mesmo navegador/dono do save): pode reassumir o próprio apelido */
      owner?: string | null;
      /** caiu: o personagem fica parado esperando a reconexão até este timer */
      dropped?: NodeJS.Timeout;
      /** tira o astronauta do mapa de vez (chamado pelo timer ou por quem reconectar) */
      finalize?: () => void;
    }
  >;
  world: GameWorldState;
  baseId: string;
  /** já existe uma linha no banco para este mundo */
  saved: boolean;
  /** eventos da base já decididos nesta sala (evita aplicar duas vezes) */
  decidedEvents?: Set<string>;
  /** missão do último jogador que salvou (volta junto no próximo salvamento) */
  mission?: unknown;
  cleanup?: NodeJS.Timeout;
  /** convites de gestos em dupla */
  gestures: GestureBroker;
}

type GameNs = Namespace<GameClientToServer, GameServerToClient, Record<string, never>, SocketData>;

const MAX_ROOMS = 500;
/** quanto tempo o astronauta de quem caiu fica parado no mapa esperando a reconexão */
const RECONNECT_GRACE_MS = 10_000;
const STATE_RATE = 40; // mensagens por segundo
const rooms = new Map<string, Room>();
/** criações em andamento (a leitura do banco é assíncrona): duas entradas simultâneas dividem a mesma sala */
const creating = new Map<string, Promise<Room>>();

/** Base da sala ativa (se houver). */
export function roomBase(code: string): string | undefined {
  return rooms.get(code)?.baseId;
}

/** O apelido já está em uso por alguém que está na sala (sem acento nem caixa)? */
export function isNicknameTaken(code: string, name: string, owner?: string | null): boolean {
  const room = rooms.get(code);
  if (!room) return false;
  const n = normalizeNickname(name);
  // quem caiu e ainda está parado no mapa não segura o apelido: a entrada nova o substitui
  return [...room.players.values()].some(
    (p) => !p.dropped && normalizeNickname(p.info.name) === n && !(owner && p.owner === owner),
  );
}

function worldFromSave(save: WorldSave | null): GameWorldState {
  const now = Date.now();
  if (!save) {
    // a sala "nasce" às 09:00 do Sol 1
    return {
      integrity: newIntegrity(Math.random() * 2 ** 32),
      clockStart: now,
      storm: 0,
      solar: new Array<number>(GAME_MAX_SOLAR).fill(0),
      crops: [],
    };
  }
  const solar = new Array<number>(GAME_MAX_SOLAR).fill(0);
  save.solar.forEach((v, i) => {
    if (i < GAME_MAX_SOLAR) solar[i] = v;
  });
  return {
    // o relógio retoma de onde o mundo parou, com a mesma velocidade/pausa
    integrity: restoreIntegrity(save.integrity) ?? newIntegrity(Math.random() * 2 ** 32),
    clockStart: now - save.elapsedMs,
    storm: 0,
    solar,
    crops: save.crops,
    vehicle: save.vehicle,
    care: normalizeCare(save.care) ?? undefined,
    board: normalizeBoard(save.board) ?? undefined,
    timeScale: normalizeTimeScale(save.timeScale),
    paused: save.paused === true,
    timeUpdatedAt: now,
    virtualElapsedMs: save.elapsedMs,
  };
}

/** Estado atual do relógio da sala (para reenviar a quem teve o pedido recusado). */
function timeState(world: GameWorldState, now: number): GameTimeState {
  return {
    paused: world.paused === true || Boolean(world.repairPause),
    scale: normalizeTimeScale(world.timeScale),
    timeUpdatedAt: now,
    virtualElapsedMs: worldClock(world, now).elapsedMs,
  };
}

/** Coordenador = astronauta de menor vaga presente (mesma regra do cliente). */
function isCoordinator(room: Room, socketId: string): boolean {
  const me = room.players.get(socketId);
  if (!me) return false;
  for (const p of room.players.values())
    if (!p.dropped && p.info.slot < me.info.slot) return false;
  return true;
}

/**
 * Sala em memória, do banco ou nova. Só cria do zero quem abriu a sala (ou já estava nela):
 * quem chega só com o código, depois de um reinício do servidor, não inventa um mundo com outra base.
 */
async function getRoom(
  code: string,
  baseId: string,
  allowCreate = true,
  fresh = false,
  difficulty?: Difficulty,
): Promise<Room> {
  const live = rooms.get(code);
  // código recém-sorteado que já pertence a outro mundo: o cliente sorteia outro
  if (live && fresh) throw new RoomTakenError();
  if (live) return live;
  if (fresh && creating.has(code)) throw new RoomTakenError();
  let pending = creating.get(code);
  if (!pending) {
    if (rooms.size + creating.size >= MAX_ROOMS) throw new Error('Servidor cheio');
    pending = (async () => {
      let saved: Awaited<ReturnType<typeof loadWorld>> = null;
      try {
        saved = await loadWorld(code);
      } catch (err) {
        console.error('[game] falha ao ler o mundo salvo:', (err as Error).message);
        throw new Error('Não foi possível consultar o mundo. Tente novamente.');
      }
      if (saved && fresh) throw new RoomTakenError();
      if (!saved && !allowCreate)
        throw new Error('Sala não encontrada. Confira o código ou peça um novo convite.');
      const movement = new RoomMovement(saved?.baseId ?? baseId, saved?.save.vehicle);
      const simulation = new RoomSimulation(saved?.baseId ?? baseId, code, movement, saved?.save);
      // a dificuldade escolhida vale só para mundos novos; mundo salvo guarda a sua
      if (!saved && difficulty) applyDifficulty(simulation.state, difficulty);
      const room: Room = {
        simulation,
        code,
        movement,
        players: new Map(),
        gestures: new GestureBroker(),
        world: simulation.projectWorld(),
        baseId: saved?.baseId ?? baseId,
        // todo mundo é gravado no banco desde que nasce (sobrevive a reinícios do servidor)
        saved: true,
        mission: saved?.save.mission,
      };
      rooms.set(code, room);
      if (!saved) persist(room, 'criar o mundo');
      return room;
    })().finally(() => creating.delete(code));
    creating.set(code, pending);
  }
  return pending;
}

/** Código sorteado no "Jogar agora" já existe: o cliente tenta com outro. */
class RoomTakenError extends Error {
  constructor() {
    super('ROOM_TAKEN');
  }
}

/** Grava o mundo agora (a fila da simulação garante uma gravação por vez e a mais recente). */
function persist(room: Room, what: string) {
  void room.simulation
    .save((save) => saveWorld(room.code, room.baseId, save))
    .catch((err: Error) => console.error(`[game] falha ao ${what} (${room.code}):`, err.message));
}

function scheduleCleanup(room: Room) {
  if (room.players.size || room.cleanup) return;
  room.cleanup = setTimeout(() => {
    if (!room.players.size && rooms.get(room.code) === room) rooms.delete(room.code);
  }, 2 * 60_000);
  room.cleanup.unref();
}

/** Estado do mundo no formato do banco. */
function snapshot(room: Room, _mission?: unknown): WorldSave {
  return createWorldSave(room.simulation.state, room.world.vehicle);
}
/** Desligamento do servidor: grava todos os mundos abertos. */
export async function flushGameSaves() {
  await Promise.allSettled(
    [...rooms.values()].map((r) => r.simulation.save((save) => saveWorld(r.code, r.baseId, save))),
  );
}

function cleanName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  // sem caracteres de controle, espaços repetidos nem tamanho absurdo
  const clean = s
    .replace(/[\p{Cc}<>]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return clean || 'Astronauta';
}

function takeToken(data: SocketData, cost = 1): boolean {
  const now = Date.now();
  const elapsed = (now - data.refillAt) / 1000;
  data.refillAt = now;
  data.tokens = Math.min(STATE_RATE, data.tokens + elapsed * STATE_RATE);
  if (data.tokens < cost) return false;
  data.tokens -= cost;
  return true;
}

function mergeStages(current: number[], raw: unknown, max: number, top: number): number[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > max) return null;
  const next = [...current];
  let changed = false;
  for (const change of raw) {
    if (!change || typeof change !== 'object') continue;
    const { index, stage } = change;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= max ||
      !Number.isInteger(stage) ||
      stage < 0 ||
      stage > top
    )
      continue;
    if (next[index] === stage) continue;
    while (next.length <= index) next.push(0);
    next[index] = stage;
    changed = true;
  }
  return changed ? next : null;
}

function takeMotionToken(data: SocketData) {
  const now = Date.now();
  data.motionTokens = Math.min(
    STATE_RATE,
    data.motionTokens + (Math.max(0, now - data.motionRefillAt) * STATE_RATE) / 1000,
  );
  data.motionRefillAt = now;
  if (data.motionTokens < 1) return false;
  data.motionTokens--;
  return true;
}

export function registerGameNamespace(io: { of(name: string): unknown }): void {
  // O namespace `/game` tem os próprios eventos (o servidor principal tipa os de mensagens).
  const ns = io.of(GAME_NAMESPACE) as GameNs;

  // Vínculos com mais de 30 dias sem uso caem; mundo sem vínculo é apagado.
  void purgeExpired().catch((e: Error) => console.error('[game] limpeza de mundos:', e.message));
  const sweep = setInterval(() => void purgeExpired().catch(() => {}), 24 * 60 * 60 * 1000);
  sweep.unref();

  function publish(room: Room) {
    room.world = room.simulation.projectWorld();
    const update = room.simulation.update();
    if (!update) return;
    for (const id of room.players.keys()) {
      const socket = ns.sockets.get(id);
      if (!socket) continue;
      // Engine.IO congestion: keep only one current snapshot outside the transport queue.
      const transport = socket.conn;
      if ((transport as unknown as {writeBuffer:unknown[]}).writeBuffer.length > 2) { socket.data.needsGameplaySnapshot = true; continue; }
      if (socket.data.needsGameplaySnapshot) {
        socket.data.needsGameplaySnapshot = false;
        socket.emit('game:snapshot',room.simulation.snapshot());
      } else socket.emit('game:update',update);
    }
  }
  let gamePrevious = performance.now(), gameAccumulator = 0, publishAccumulator = 0;
  const hazards = setInterval(() => {
    const current = performance.now();
    // Bounded catch-up: no unprocessed wall time is assigned to the world clock.
    gameAccumulator = Math.min(500,gameAccumulator+Math.max(0,current-gamePrevious));
    gamePrevious = current;
    const now=Date.now();
    let steps=0;
    while(gameAccumulator>=GAME_STEP_MS && steps++<5) {
      gameAccumulator-=GAME_STEP_MS; publishAccumulator+=GAME_STEP_MS;
      for(const room of rooms.values()) if(room.players.size) {
        const before=room.simulation.state.mission.nextLogId;
        const pause=room.simulation.state.pauses.join(',');
        room.simulation.step();
        room.world=room.simulation.projectWorld(now);
        if(before!==room.simulation.state.mission.nextLogId || pause!==room.simulation.state.pauses.join(','))publish(room);
      }
    }
    if(publishAccumulator>=GAME_PUBLISH_MS) {
      publishAccumulator%=GAME_PUBLISH_MS;
      for(const room of rooms.values())if(room.players.size)publish(room);
    }
    for(const room of rooms.values())if(room.saved && room.simulation.autosaveDue(now))
      void room.simulation.save(save=>saveWorld(room.code,room.baseId,save)).catch(err=>console.error('[game] autosave:',err.message));
  },GAME_STEP_MS);
  hazards.unref();

  let previousStep = performance.now(),
    accumulator = 0,
    snapshotElapsed = 0;
  const movementTimer = setInterval(() => {
    const current = performance.now();
    const elapsed = Math.min(5 * MOVEMENT_DT, (current - previousStep) / 1000);
    previousStep = current;
    accumulator += elapsed;
    snapshotElapsed += elapsed;
    const now = Date.now();
    while (accumulator >= MOVEMENT_DT) {
      accumulator -= MOVEMENT_DT;
      for (const room of rooms.values()) {
        const scale =
          room.world.paused || room.world.repairPause
            ? 0
            : normalizeTimeScale(room.world.timeScale);
        room.movement.step(now, scale, room.world.storm > 0.25);
        for (const [id, p] of room.players) p.motion = room.movement.players.get(id)?.state;
        room.world.vehicle = {
          x: room.movement.rover.x,
          z: room.movement.rover.z,
          h: room.movement.rover.h,
        };
      }
    }
    if (snapshotElapsed >= 0.05) {
      snapshotElapsed %= 0.05;
      for (const room of rooms.values())
        if (room.players.size) {
          const scale =
            room.world.paused || room.world.repairPause
              ? 0
              : normalizeTimeScale(room.world.timeScale);
          ns.to(room.code).volatile.emit('movement:snapshot', room.movement.snapshot(now, scale));
        }
    }
  }, 10);
  movementTimer.unref();

  ns.server.httpServer.once('close', () => {
    clearInterval(movementTimer);
    clearInterval(sweep);
    clearInterval(hazards);
    for (const room of rooms.values()) clearTimeout(room.cleanup);
    rooms.clear();
    creating.clear();
  });

  ns.on('connection', (socket) => {
    socket.data.motionTokens = STATE_RATE;
    socket.data.motionRefillAt = Date.now();
    socket.data.tokens = STATE_RATE;
    socket.data.refillAt = Date.now();

    socket.on('room:join', async (raw, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (socket.data.room || socket.data.joining)
        return reply({ ok: false, error: 'Você já está entrando numa sala' });
      if (!takeToken(socket.data, 10)) return reply({ ok: false, error: 'Calma!' });

      const req = (raw ?? {}) as unknown as Record<string, unknown>;
      if (req.gameplayVersion !== GAMEPLAY_VERSION || req.movementVersion !== MOVEMENT_VERSION || req.navigationHash !== NAVIGATION_HASH)
        return reply({ ok: false, error: 'Versão do jogo incompatível. Atualize a página.' });
      const code = typeof req.code === 'string' ? req.code.trim().toUpperCase() : '';
      if (!GAME_ROOM_CODE_RE.test(code))
        return reply({ ok: false, error: 'Código de sala inválido' });
      const baseId =
        typeof req.base === 'string' && /^[a-z]{3,12}$/.test(req.base) ? req.base : 'jezero';

      const name = cleanName(req.name);
      if (name.length < NICKNAME_MIN || name.length > NICKNAME_MAX) {
        return reply({
          ok: false,
          error: `O apelido precisa ter de ${NICKNAME_MIN} a ${NICKNAME_MAX} caracteres.`,
        });
      }

      if (hasProfanity(name)) return reply({ ok: false, error: PROFANITY_NICK_MESSAGE });

      if (!rooms.has(code) && rooms.size >= MAX_ROOMS) {
        return reply({ ok: false, error: 'Servidor cheio' });
      }
      socket.data.joining = true;
      try {
        let owner: string | null = null;
        try {
          owner = await playerFromCookies(socket.handshake.headers.cookie);
        } catch {
          owner = null;
        }
        const savedSuit = owner ? await linkSuit(owner, code).catch(() => null) : null;
        if (socket.disconnected) return;
        const room = await getRoom(code, baseId, req.create === true, req.fresh === true, isDifficulty(req.difficulty) ? req.difficulty : undefined);
        if (socket.disconnected) {
          scheduleCleanup(room);
          return;
        }
        if (room.baseId !== baseId) {
          scheduleCleanup(room);
          return reply({ ok: false, error: 'Esta sala usa outra base.', baseId: room.baseId });
        }
        // Mundo com 4 jogadores vinculados: quem não é um deles entra e joga, só não ganha o
        // mundo em "Meus mundos" (o vínculo é recusado em `touchLink`).
        const resumeToken =
          typeof req.resumeToken === 'string' && /^[a-f0-9]{48}$/.test(req.resumeToken)
            ? req.resumeToken
            : undefined;
        const previous =
          resumeToken && [...room.players.values()].find((p) => p.resumeToken === resumeToken);
        // A conexão antiga pode ainda estar esperando o ping expirar depois de trocar de Wi-Fi.
        // Só quem conhece o segredo desta instância pode substituí-la.
        if (previous) ns.sockets.get(previous.info.id)?.disconnect(false);
        // Quem caiu e voltou (ou entrou de novo com o mesmo apelido): o astronauta parado sai
        // agora e a entrada nova retoma a posição dele.
        const wantedName = normalizeNickname(name);
        // o dono do save voltando (aba antiga ainda aberta, ping ainda não expirou): assume o lugar
        for (const p of [...room.players.values()]) {
          if (!p.dropped && owner && p.owner === owner && normalizeNickname(p.info.name) === wantedName)
            ns.sockets.get(p.info.id)?.disconnect(true);
        }
        for (const p of [...room.players.values()]) {
          if (
            p.dropped &&
            ((resumeToken && p.resumeToken === resumeToken) ||
              normalizeNickname(p.info.name) === wantedName)
          )
            p.finalize?.();
        }
        if (room.players.size >= GAME_MAX_PLAYERS) {
          return reply({ ok: false, error: `Sala cheia (máx. ${GAME_MAX_PLAYERS} astronautas)` });
        }
        const wanted = normalizeNickname(name);
        if ([...room.players.values()].some((p) => normalizeNickname(p.info.name) === wanted)) {
          return reply({
            ok: false,
            error: 'Já há um astronauta com esse apelido neste mundo. Escolha outro.',
          });
        }
        if (room.cleanup) {
          clearTimeout(room.cleanup);
          room.cleanup = undefined;
        }

        const used = new Set([...room.players.values()].map((p) => p.info.slot));
        let slot = 0;
        while (used.has(slot)) slot++;

        const info: GamePlayerInfo = {
          id: socket.id,
          name,
          // o traje pertence ao jogador NESTE mundo: quem já tem vínculo volta com o mesmo
          suit: savedSuit ?? normalizeSuit(req.suit),
          slot,
        };
        const others = [...room.players.values()].map((p) => ({ ...p.info, motion: p.motion }));
        room.players.set(socket.id, {
          info,
          motion: room.movement.join(socket.id, slot, resumeToken),
          resumeToken,
          owner,
        });
        room.simulation.join(socket.id,name,resumeToken);
        publish(room);
        socket.data.room = code;
        socket.data.info = info;
        socket.data.owner = owner;
        void socket.join(code);
        socket
          .to(code)
          .emit('player:joined', { ...info, motion: room.players.get(socket.id)?.motion });

        // O banco não bloqueia a entrada nem deixa o roster do ACK desatualizado.
        // Quem aceitou o cookie ganha o mundo em "Meus mundos" (depois que a linha do mundo existe).
        const linked = Boolean(owner);
        socket.data.linked = linked;
        if (owner)
          void room.simulation
            .flush()
            .then(() => touchLink(owner, code, name, info.suit))
            .then((ok) => {
              if (!ok) socket.data.linked = false;
            })
            .catch((err: Error) =>
              console.error('[game] falha ao salvar o vínculo do mundo:', err.message),
            );
        // entrou alguém: grava logo (o mundo e quem está nele ficam no banco)
        persist(room, 'gravar a entrada');
        reply({
          ok: true,
          baseId: room.baseId,
          gameplay: room.simulation.snapshot(),
          movement: room.movement.snapshot(
            Date.now(),
            room.world.paused ? 0 : normalizeTimeScale(room.world.timeScale),
          ),
          self: info,
          players: others,
          world: room.world,
          serverNow: Date.now(),
          persistence: { linked, canSave: Boolean(owner), mission: room.mission },
        });
      } catch (err) {
        if (err instanceof RoomTakenError)
          return reply({ ok: false, error: 'Código já usado por outro mundo.', taken: true });
        reply({
          ok: false,
          error: err instanceof Error ? err.message : 'Não foi possível entrar na sala.',
        });
      } finally {
        socket.data.joining = false;
      }
    });

    /** Salva o mundo (botão "salvar e sair" ou salvamento automático do cliente a cada 5 min). */
    socket.on('world:save', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room) return reply({ ok: false, error: 'Você não está num mundo' });
      if (!takeToken(socket.data, 5)) return reply({ ok: false, error: 'Calma!' });
      const owner = socket.data.owner;
      if (!owner) {
        return reply({
          ok: false,
          error: 'Para salvar, aceite o cookie de salvamento.',
        });
      }
      if (payload && Object.keys(payload).length) return reply({ok:false,error:'O servidor monta o salvamento.'});
      const save = snapshot(room);
      if (!save) return reply({ ok: false, error: 'Dados de salvamento inválidos' });
      try {
        await room.simulation.save(save => saveWorld(room.code, room.baseId, save));
        room.saved = true;
        room.mission = save.mission;
        await touchLink(owner, room.code, socket.data.info?.name ?? '', socket.data.info?.suit);
        socket.data.linked = true;
        reply({ ok: true, savedAt: Date.now() });
      } catch (err) {
        console.error('[game] falha ao salvar o mundo:', (err as Error).message);
        reply({ ok: false, error: 'Não foi possível salvar agora. Tente de novo.' });
      }
    });

    /** "Voltar ao último save": recarrega do banco o mundo salvo (só quando se está sozinho na sala). */
    socket.on('world:restore', async (ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room) return reply({ ok: false, error: 'Você não está num mundo' });
      if (!takeToken(socket.data, 5)) return reply({ ok: false, error: 'Calma!' });
      if (!room.saved || !socket.data.linked) {
        return reply({ ok: false, error: 'Este mundo não tem um salvamento seu.' });
      }
      if (room.players.size > 1) {
        return reply({
          ok: false,
          error: 'Há outros astronautas na sala: só dá para voltar ao save estando sozinho.',
        });
      }
      try {
        const saved = await loadWorld(room.code);
        if (socket.disconnected || room.players.size !== 1 || !room.players.has(socket.id))
          return reply({
            ok: false,
            error: 'A tripulação mudou durante a restauração. Tente novamente estando sozinho.',
          });
        if (!saved) return reply({ ok: false, error: 'Nenhum salvamento encontrado.' });
        await room.simulation.flush();
        const player = room.players.get(socket.id);
        room.movement = new RoomMovement(room.baseId, saved.save.vehicle);
        if (player)
          player.motion = room.movement.join(socket.id, player.info.slot, player.resumeToken);
        socket.emit('movement:snapshot', room.movement.snapshot(Date.now(), 1));
        room.simulation = new RoomSimulation(room.baseId,room.code,room.movement,saved.save);
        room.simulation.join(socket.id,socket.data.info?.name ?? 'Astronauta',player?.resumeToken);
        room.world=room.simulation.projectWorld();
        socket.emit('game:snapshot',room.simulation.snapshot());
        reply({ ok: true, restored: true });
      } catch (err) {
        console.error('[game] falha ao restaurar o mundo:', (err as Error).message);
        reply({ ok: false, error: 'Não foi possível carregar o save agora.' });
      }
    });

    socket.on('game:command',(raw,ack)=> {
      if(typeof ack!=='function')return;
      const room=socket.data.room?rooms.get(socket.data.room):undefined;
      if(!room)return;
      const now=Date.now(),data=socket.data;
      const reject=(code:'RATE_LIMITED'|'INVALID_COMMAND')=>ack({ok:false,operationId:typeof raw?.operationId==='string'?raw.operationId:'',generation:room.simulation.state.generation,revision:room.simulation.state.revision,code,error:code});
      if(Buffer.byteLength(JSON.stringify(raw??{}),'utf8')>8192)return reject('INVALID_COMMAND');
      data.gameTokens=Math.min(20,data.gameTokens+(now-data.gameAt)*0.02);data.gameAt=now;
      if(data.gameTokens<1)return reject('RATE_LIMITED');
      data.gameTokens--;
      const continuous=raw?.payload?.type==='actions';
      if(continuous && now-data.actionAt<90)return reject('RATE_LIMITED');
      if(continuous)data.actionAt=now;
      const result=room.simulation.command(socket.id,raw,isCoordinator(room,socket.id));
      if(result.ok && raw.payload.type==='ready') room.movement.action(socket.id,'ready');
      ack(result);
      if(result.ok && !continuous)publish(room);
    });
    socket.on('game:resync',()=> {
      const room=socket.data.room?rooms.get(socket.data.room):undefined;
      if(!room||Date.now()-socket.data.resyncAt<500)return;
      socket.data.resyncAt=Date.now();socket.emit('game:snapshot',room.simulation.snapshot());
    });
    socket.on('world:repair',(intent,ack)=> {
      const reply=typeof ack==='function'?ack:()=>{};
      const room=socket.data.room?rooms.get(socket.data.room):undefined;
      if(!room || !takeToken(socket.data) || !intent || typeof intent!=='object' || !room.simulation.repair(socket.id,intent,process.env.NODE_ENV!=='production' && isCoordinator(room,socket.id)))
        return reply({ok:false,error:'Reparo ocupado ou indisponível'});
      publish(room);reply({ok:true,state:room.simulation.state.integrity});
    });

    socket.on('movement:input', (input) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (room && takeMotionToken(socket.data)) room.movement.input(socket.id, input, Date.now());
    });
    socket.on('movement:action', (action, ack) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2) || typeof ack !== 'function') return;
      const error = action === 'infirmary' ? 'Socorro exclusivo do servidor.' : room.simulation.state.players[socket.id]?.blocked && action !== 'ready' ? 'Astronauta ocupado.' : room.movement.action(socket.id, action);
      const scale =
        room.world.paused || room.world.repairPause ? 0 : normalizeTimeScale(room.world.timeScale);
      const snapshot = room.movement.snapshot(Date.now(), scale);
      ack({ ok: !error, error: error ?? undefined, snapshot });
      ns.to(room.code).emit('movement:snapshot', snapshot);
    });
    // Legacy player:state is deliberately ignored: clients cannot assign positions.

    // Removed authority paths remain explicit refusals for clients from older releases.
    socket.on('mission:event',(_raw,ack)=> { if(typeof ack==='function')ack({ok:false,error:'Atualize a página: progresso validado pelo servidor.'}); });

    socket.on('player:chat', (raw) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2) || typeof raw !== 'string') return;
      const message = raw.trim().slice(0, 240);
      if (message && hasProfanity(message)) return void socket.emit('gesture:denied', PROFANITY_MESSAGE);
      if (message) socket.to(room.code).emit('player:chat', socket.id, message);
    });

    socket.on('player:emote', (raw) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room) return;
      // no máximo 1 emoji por segundo por jogador; só os do painel (índice inteiro válido)
      const now = Date.now();
      if (now - (socket.data.lastEmote ?? 0) < 900) return;
      if (
        typeof raw !== 'number' ||
        !Number.isInteger(raw) ||
        raw < 0 ||
        raw >= GAME_EMOTES.length
      ) {
        return;
      }
      socket.data.lastEmote = now;
      socket.to(room.code).emit('player:emote', socket.id, raw);
    });

    // Gestos em dupla: convite -> aceite -> início para a sala (tudo validado no broker)
    socket.on('gesture:invite', (gesture, targetId) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 3)) return;
      const lookup = (id: string) => room.players.get(id);
      const res = room.gestures.invite(socket.id, targetId, gesture, lookup, Date.now());
      if (!res.ok) return void socket.emit('gesture:denied', res.reason);
      ns.to(res.targetId).emit('gesture:invite', socket.id, res.gesture);
    });

    socket.on('gesture:accept', (fromId) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 3)) return;
      const res = room.gestures.accept(socket.id, fromId, (id) => room.players.get(id), Date.now());
      if (!res.ok) return void socket.emit('gesture:denied', res.reason);
      if (!room.movement.gesture(res.start))
        return void socket.emit('gesture:denied', 'Sem espaço livre para o gesto.');
      ns.to(room.code).emit('gesture:start', res.start);
      ns.to(room.code).emit(
        'movement:snapshot',
        room.movement.snapshot(
          Date.now(),
          room.world.paused ? 0 : normalizeTimeScale(room.world.timeScale),
        ),
      );
    });

    socket.on('disconnect', () => {
      const code = socket.data.room;
      const room = code ? rooms.get(code) : undefined;
      if (!room) return;
      const leaving = room.players.get(socket.id);
      if (!leaving) return;
      if (room.world.repairPause === socket.id) {
        room.world.repairPause = undefined;
        room.world.timeUpdatedAt = Date.now();
      }
      // Caiu: o astronauta fica parado onde estava por alguns segundos, esperando a reconexão.
      const sim = room.simulation.state.players[socket.id];
      if (sim) {
        sim.ready = false;
        room.simulation.state.revision++;
      }
      room.movement.restrict(socket.id, { blocked: true, cold: false });
      publish(room);
      leaving.finalize = () => {
        if (room.players.get(socket.id) !== leaving) return;
        clearTimeout(leaving.dropped);
        removeDropped(room, socket.id, leaving);
      };
      leaving.dropped = setTimeout(leaving.finalize, RECONNECT_GRACE_MS);
      leaving.dropped.unref();
      persist(room, 'gravar a saída');
      if (room.saved && socket.data.linked && socket.data.owner) {
        void touchLink(
          socket.data.owner,
          room.code,
          socket.data.info?.name ?? '',
          socket.data.info?.suit,
        ).catch(() => {});
      }
    });
  });

  /** O astronauta de quem caiu sai do mapa de vez (pode voltar pelo código da sala). */
  function removeDropped(
    room: Room,
    id: string,
    leaving: NonNullable<ReturnType<Room['players']['get']>>,
  ) {
    // quem cai dirigindo deixa o rover parado onde estava
    if (leaving.motion?.m === 'drive') {
      room.world.vehicle = { x: leaving.motion.x, z: leaving.motion.z, h: leaving.motion.h };
      ns.to(room.code).emit('world:vehicle', room.world.vehicle);
    }
    room.simulation.leave(id);
    room.movement.remove(id, leaving.resumeToken);
    room.players.delete(id);
    ns.to(room.code).emit(
      'movement:snapshot',
      room.movement.snapshot(
        Date.now(),
        room.world.paused ? 0 : normalizeTimeScale(room.world.timeScale),
      ),
    );
    room.gestures.remove(id);
    ns.to(room.code).emit('player:left', id);
    publish(room);
    if (room.players.size === 0) {
      room.world = room.simulation.projectWorld();
      persist(room, 'gravar o mundo vazio');
      // mantém o mundo por 2 min: quem volta reencontra a mesma partida
      scheduleCleanup(room);
    }
  }
}
