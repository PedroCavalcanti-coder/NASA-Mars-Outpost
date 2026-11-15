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
  repairIntent,
  restoreIntegrity,
  tickIntegrity,
  type WorldSave,
  worldClock,
} from '@mars/shared';
import type { Namespace } from 'socket.io';
import {
  loadWorld,
  ownerFromCookies,
  purgeExpired,
  sanitizeSave,
  saveWorld,
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
  players: Map<string, { info: GamePlayerInfo; motion?: GameMotion }>;
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
/** limite do mundo: nada que se mova pode estar além disso (unidades de mundo) */
const WORLD_LIMIT = 200;
const STATE_RATE = 40; // mensagens por segundo
const rooms = new Map<string, Room>();
/** criações em andamento (a leitura do banco é assíncrona): duas entradas simultâneas dividem a mesma sala */
const creating = new Map<string, Promise<Room>>();

/** O apelido já está em uso por alguém que está na sala (sem acento nem caixa)? */
export function isNicknameTaken(code: string, name: string): boolean {
  const room = rooms.get(code);
  if (!room) return false;
  const n = normalizeNickname(name);
  return [...room.players.values()].some((p) => normalizeNickname(p.info.name) === n);
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
  for (const p of room.players.values()) if (p.info.slot < me.info.slot) return false;
  return true;
}

async function getRoom(code: string, baseId: string): Promise<Room> {
  const live = rooms.get(code);
  if (live) return live;
  let pending = creating.get(code);
  if (!pending) {
    pending = (async () => {
      let saved: Awaited<ReturnType<typeof loadWorld>> = null;
      try {
        saved = await loadWorld(code);
      } catch (err) {
        console.error('[game] falha ao ler o mundo salvo:', (err as Error).message);
      }
      const room: Room = {
        code,
        players: new Map(),
        gestures: new GestureBroker(),
        world: worldFromSave(saved?.save ?? null),
        baseId: saved?.baseId ?? baseId,
        saved: Boolean(saved),
        mission: saved?.save.mission,
      };
      rooms.set(code, room);
      return room;
    })().finally(() => creating.delete(code));
    creating.set(code, pending);
  }
  return pending;
}

/** Estado do mundo no formato do banco. */
function snapshot(room: Room, mission: unknown): WorldSave | null {
  return sanitizeSave({
    elapsedMs: worldClock(room.world, Date.now()).elapsedMs,
    solar: room.world.solar,
    crops: room.world.crops,
    vehicle: room.world.vehicle,
    care: room.world.care,
    board: room.world.board,
    timeScale: room.world.timeScale,
    paused: room.world.paused,
    integrity: room.world.integrity,
    mission,
  });
}

const finite = (n: unknown, lim: number): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= lim;

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

function parseMotion(raw: unknown): GameMotion | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (!finite(m.x, WORLD_LIMIT) || !finite(m.z, WORLD_LIMIT) || !finite(m.h, 20)) return null;
  const kind =
    m.m === 'walk' ||
    m.m === 'clean' ||
    m.m === 'plant' ||
    m.m === 'harvest' ||
    m.m === 'drive' ||
    m.m === 'ride'
      ? m.m
      : 'idle';
  return { x: m.x, z: m.z, h: m.h, m: kind };
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

export function registerGameNamespace(io: { of(name: string): unknown }): void {
  // O namespace `/game` tem os próprios eventos (o servidor principal tipa os de mensagens).
  const ns = io.of(GAME_NAMESPACE) as GameNs;

  // Vínculos com mais de 30 dias sem uso caem; mundo sem vínculo é apagado.
  void purgeExpired().catch((e: Error) => console.error('[game] limpeza de mundos:', e.message));
  const sweep = setInterval(() => void purgeExpired().catch(() => {}), 24 * 60 * 60 * 1000);
  sweep.unref();

  const hazards = setInterval(() => {
    for (const room of rooms.values()) {
      if (!room.players.size) continue;
      const w = room.world;
      const c = worldClock(w, Date.now());
      w.integrity ??= newIntegrity();
      const rev = w.integrity.revision;
      const wind = w.integrity.wind;
      tickIntegrity(w.integrity, c.elapsedMs / 1000, Date.now(), c.hour);
      if (w.integrity.wind > wind) {
        w.solar = w.solar.map((n) => Math.max(0, n - 1));
        ns.to(room.code).emit('world:solar', w.solar);
      }
      const e = w.integrity.event;
      const storm = e?.id === 'dust_storm' && c.elapsedMs / 1000 - e.start >= 15 ? 0.85 : 0;
      if (w.storm !== storm) {
        w.storm = storm;
        ns.to(room.code).emit('world:storm', storm);
      }
      if (w.integrity.revision !== rev) ns.to(room.code).emit('world:integrity', w.integrity);
    }
  }, 250);
  hazards.unref();

  ns.on('connection', (socket) => {
    socket.data.tokens = STATE_RATE;
    socket.data.refillAt = Date.now();

    socket.on('room:join', async (raw, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (socket.data.room) return reply({ ok: false, error: 'Você já está numa sala' });
      if (!takeToken(socket.data, 10)) return reply({ ok: false, error: 'Calma!' });

      const req = (raw ?? {}) as unknown as Record<string, unknown>;
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

      if (!rooms.has(code) && rooms.size >= MAX_ROOMS) {
        return reply({ ok: false, error: 'Servidor cheio' });
      }
      let owner: string | null = null;
      try {
        owner = await ownerFromCookies(socket.handshake.headers.cookie);
      } catch {
        owner = null;
      }
      const room = await getRoom(code, baseId);
      if (socket.disconnected) return;
      if (room.cleanup) {
        clearTimeout(room.cleanup);
        room.cleanup = undefined;
      }
      if (room.players.size >= GAME_MAX_PLAYERS) {
        return reply({ ok: false, error: `Sala cheia (máx. ${GAME_MAX_PLAYERS} astronautas)` });
      }
      // Apelido único entre quem está no mapa (conferido e reservado no mesmo passo, sem await no meio)
      const wanted = normalizeNickname(name);
      if ([...room.players.values()].some((p) => normalizeNickname(p.info.name) === wanted)) {
        return reply({
          ok: false,
          error: 'Já há um astronauta com esse apelido neste mundo. Escolha outro.',
        });
      }

      const used = new Set([...room.players.values()].map((p) => p.info.slot));
      let slot = 0;
      while (used.has(slot)) slot++;

      const info: GamePlayerInfo = {
        id: socket.id,
        name,
        suit: normalizeSuit(req.suit),
        slot,
      };
      const others = [...room.players.values()].map((p) => ({ ...p.info, motion: p.motion }));
      if (room.world.repairPause && room.world.repairPause !== 'empty') {
        room.world.repairPause = undefined;
        room.world.timeUpdatedAt = Date.now();
      }
      room.players.set(socket.id, { info });
      ns.to(room.code).emit('world:time', timeState(room.world, Date.now()));
      socket.data.room = code;
      socket.data.info = info;
      socket.data.owner = owner;
      void socket.join(code);
      socket.to(code).emit('player:joined', info);

      // Mundo já salvo: entrar de novo renova o vínculo (a contagem dos 30 dias recomeça)
      let linked = false;
      if (owner && room.saved) {
        try {
          await touchLink(owner, code, name);
          linked = true;
        } catch (err) {
          console.error('[game] falha ao renovar o vínculo:', (err as Error).message);
        }
      }
      socket.data.linked = linked;

      if (room.world.repairPause === 'empty') {
        room.world.repairPause = undefined;
        room.world.timeUpdatedAt = Date.now();
      }
      reply({
        ok: true,
        self: info,
        players: others,
        world: room.world,
        serverNow: Date.now(),
        persistence: { linked, canSave: Boolean(owner), mission: room.mission },
      });
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
          error: 'Para salvar, aceite o cookie de salvamento ou entre na sua conta.',
        });
      }
      const mission = (payload as { mission?: unknown } | undefined)?.mission;
      const save = snapshot(room, mission ?? room.mission);
      if (!save) return reply({ ok: false, error: 'Dados de salvamento inválidos' });
      try {
        await saveWorld(room.code, room.baseId, save);
        room.saved = true;
        room.mission = save.mission;
        await touchLink(owner, room.code, socket.data.info?.name ?? '');
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
        if (!saved) return reply({ ok: false, error: 'Nenhum salvamento encontrado.' });
        room.world = worldFromSave(saved.save);
        room.mission = saved.save.mission;
        reply({ ok: true, restored: true });
      } catch (err) {
        console.error('[game] falha ao restaurar o mundo:', (err as Error).message);
        reply({ ok: false, error: 'Não foi possível carregar o save agora.' });
      }
    });

    socket.on('world:repair', (intent, ack) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data) || !intent || typeof intent !== 'object')
        return ack?.({ ok: false, error: 'Pedido inválido' });
      const c = worldClock(room.world, Date.now());
      const state = (room.world.integrity ??= newIntegrity());
      if (
        ![
          'ready',
          'stop',
          'restart',
          'event',
          'emergency',
          'damage',
          'reserve',
          'heartbeat',
          'release',
          'plate',
          'screw',
        ].includes(intent.op)
      )
        return ack?.({ ok: false, error: 'Pedido inválido' });
      if (intent.op === 'reserve') {
        const f = state.fractures.find((f) => f.id === intent.fracture);
        const anchors = REPAIR_ANCHORS[room.baseId as keyof typeof REPAIR_ANCHORS];
        const a = f && anchors?.[f.anchor];
        const motion = room.players.get(socket.id)?.motion;
        if (!a || !motion || Math.hypot(motion.x - a.approach[0], motion.z - a.approach[2]) > 3.5)
          return ack?.({ ok: false, error: 'Aproxime-se da fratura.' });
      }
      if (
        !repairIntent(
          state,
          intent,
          socket.id,
          c.elapsedMs / 1000,
          Date.now(),
          process.env.NODE_ENV !== 'production',
        )
      )
        return ack?.({ ok: false, error: 'Reparo ocupado ou indisponível' });
      ns.to(room.code).emit('world:integrity', state);
      ack?.({ ok: true, state });
    });
    socket.on('world:repair-pause', (active) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (room) {
        const was = room.world.paused === true;
        applyTimeChange(room.world, Date.now(), {
          paused: was,
          scale: normalizeTimeScale(room.world.timeScale),
        });
        room.world.repairPause = active === true && room.players.size === 1 ? socket.id : undefined;
        const t = timeState(room.world, Date.now());
        ns.to(room.code).emit('world:time', t);
      }
    });

    socket.on('player:state', (raw) => {
      const code = socket.data.room;
      const room = code ? rooms.get(code) : undefined;
      if (!room || !takeToken(socket.data)) return;
      const motion = parseMotion(raw);
      if (!motion) return;
      const p = room.players.get(socket.id);
      if (p) p.motion = motion;
      socket.to(room.code).volatile.emit('player:state', socket.id, motion);
    });

    socket.on('world:storm', (value) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2)) return;
      const v =
        typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      room.world.storm = v;
      socket.to(room.code).emit('world:storm', v);
    });

    /** Pausa / velocidade / salto de tempo: vale para a sala inteira. */
    socket.on('world:time', (raw) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2) || !raw || typeof raw !== 'object') return;
      const now = Date.now();
      // com mais de um astronauta, só o coordenador decide; os outros recebem o estado de volta
      if (room.players.size > 1 && !isCoordinator(room, socket.id)) {
        socket.emit('world:time', timeState(room.world, now));
        return;
      }
      const req = raw as unknown as Record<string, unknown>;
      const t = applyTimeChange(room.world, now, {
        paused: req.paused === true,
        scale: normalizeTimeScale(req.scale),
        advanceMs: typeof req.advanceMs === 'number' ? req.advanceMs : 0,
      });
      ns.to(room.code).emit('world:time', t);
    });

    socket.on('world:solar', (stages) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2) || !Array.isArray(stages)) return;
      const next = room.world.solar.slice();
      for (let i = 0; i < Math.min(stages.length, GAME_MAX_SOLAR); i++) {
        const s = stages[i];
        if (typeof s === 'number' && Number.isFinite(s))
          next[i] = Math.max(0, Math.min(4, Math.round(s)));
      }
      room.world.solar = next;
      socket.to(room.code).emit('world:solar', next);
    });

    socket.on('world:crops', (stages) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2) || !Array.isArray(stages)) return;
      const next: number[] = [];
      for (let i = 0; i < Math.min(stages.length, GAME_MAX_CROPS); i++) {
        const s = stages[i];
        next.push(
          typeof s === 'number' && Number.isFinite(s) ? Math.max(0, Math.min(3, Math.round(s))) : 0,
        );
      }
      room.world.crops = next;
      socket.to(room.code).emit('world:crops', next);
    });

    socket.on('world:vehicle', (raw) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2) || !raw || typeof raw !== 'object') return;
      const v = raw as unknown as Record<string, unknown>;
      if (!finite(v.x, WORLD_LIMIT) || !finite(v.z, WORLD_LIMIT) || !finite(v.h, 20)) return;
      room.world.vehicle = { x: v.x, z: v.z, h: v.h };
      socket.to(room.code).emit('world:vehicle', room.world.vehicle);
    });

    socket.on('world:care', (raw) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2)) return;
      const care = normalizeCare(raw);
      if (!care) return;
      room.world.care = care;
      socket.to(room.code).emit('world:care', care);
    });

    socket.on('mission:event', (raw) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 3)) return;
      const ev = normalizeMissionEvent(raw);
      if (!ev) return;
      // missão repetida no mesmo Sol (duas pessoas ao mesmo tempo) ou de um Sol antigo: ignora
      const board = applyMissionEvent(room.world.board, ev);
      if (!board) return;
      room.world.board = board;
      socket.to(room.code).emit('mission:event', ev);
    });

    socket.on('player:chat', (raw) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2) || typeof raw !== 'string') return;
      const message = raw.trim().slice(0, 240);
      if (message) socket.to(room.code).emit('player:chat', socket.id, message);
    });

    /** Voto num evento da base: repassa a todos (o servidor só valida o formato). */
    socket.on('event:vote', (eid, choice) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2)) return;
      if (typeof eid !== 'string' || eid.length > 40) return;
      if (!Number.isInteger(choice) || choice < 0 || choice > 5) return;
      socket.to(room.code).emit('event:vote', socket.id, eid, choice);
    });

    /** Decisão final do evento: vale só a primeira por evento e sala. */
    socket.on('event:result', (eid, choice, roll) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2)) return;
      if (typeof eid !== 'string' || eid.length > 40) return;
      if (!Number.isInteger(choice) || choice < 0 || choice > 5) return;
      if (typeof roll !== 'number' || !Number.isFinite(roll) || roll < 0 || roll > 1) return;
      room.decidedEvents ??= new Set();
      if (room.decidedEvents.has(eid)) return;
      room.decidedEvents.add(eid);
      socket.to(room.code).emit('event:result', eid, choice, roll);
    });

    /** Coleta de solo em dupla: repassa o início e as notas aos outros da sala. */
    socket.on('soil:msg', (kind, eid, quality) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2)) return;
      if (kind !== 'start' && kind !== 'done') return;
      if (typeof eid !== 'string' || eid.length > 40) return;
      if (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1)
        return;
      socket.to(room.code).emit('soil:msg', socket.id, kind, eid, quality);
    });

    /** Voto para pular a noite: repassa a todos (cada cliente confere se todos apertaram). */
    socket.on('sleep:msg', (ready) => {
      const room = socket.data.room ? rooms.get(socket.data.room) : undefined;
      if (!room || !takeToken(socket.data, 2) || typeof ready !== 'boolean') return;
      socket.to(room.code).emit('sleep:msg', socket.id, ready);
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
      ns.to(room.code).emit('gesture:start', res.start);
    });

    socket.on('disconnect', () => {
      const code = socket.data.room;
      const room = code ? rooms.get(code) : undefined;
      if (!room) return;
      // quem cai dirigindo deixa o rover parado onde estava
      const leaving = room.players.get(socket.id);
      if (leaving?.motion?.m === 'drive') {
        room.world.vehicle = { x: leaving.motion.x, z: leaving.motion.z, h: leaving.motion.h };
        socket.to(room.code).emit('world:vehicle', room.world.vehicle);
      }
      if (room.world.repairPause === socket.id) {
        room.world.repairPause = undefined;
        room.world.timeUpdatedAt = Date.now();
      }
      room.players.delete(socket.id);
      room.gestures.remove(socket.id);
      socket.to(room.code).emit('player:left', socket.id);
      if (room.saved && socket.data.linked && socket.data.owner) {
        void touchLink(socket.data.owner, room.code, socket.data.info?.name ?? '').catch(() => {});
      }
      if (room.players.size === 0) {
        applyTimeChange(room.world, Date.now(), {
          paused: room.world.paused === true,
          scale: normalizeTimeScale(room.world.timeScale),
        });
        room.world.repairPause = 'empty';
        // o último jogador a sair deixa o mundo como ele ficou (se o mundo é salvo)
        if (room.saved) {
          const save = snapshot(room, room.mission);
          if (save) void saveWorld(room.code, room.baseId, save).catch(() => {});
        }
        // mantém o mundo por 2 min: quem cai e volta reencontra a mesma partida
        room.cleanup = setTimeout(() => rooms.delete(room.code), 2 * 60_000);
        room.cleanup.unref();
      }
    });
  });
}
