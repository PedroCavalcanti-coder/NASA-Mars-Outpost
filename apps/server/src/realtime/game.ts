import {
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
  type GameWorldState,
  NICKNAME_MAX,
  NICKNAME_MIN,
  normalizeNickname,
  normalizeSuit,
  type WorldSave,
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
  /** missão do último jogador que salvou (volta junto no próximo salvamento) */
  mission?: unknown;
  cleanup?: NodeJS.Timeout;
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
    // o relógio retoma de onde o mundo parou
    clockStart: now - save.elapsedMs,
    storm: 0,
    solar,
    crops: save.crops,
    vehicle: save.vehicle,
  };
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
    elapsedMs: Date.now() - room.world.clockStart,
    solar: room.world.solar,
    crops: room.world.crops,
    vehicle: room.world.vehicle,
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
    m.m === 'walk' || m.m === 'clean' || m.m === 'plant' || m.m === 'harvest' || m.m === 'drive'
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
      room.players.set(socket.id, { info });
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
      room.players.delete(socket.id);
      socket.to(room.code).emit('player:left', socket.id);
      if (room.saved && socket.data.linked && socket.data.owner) {
        void touchLink(socket.data.owner, room.code, socket.data.info?.name ?? '').catch(() => {});
      }
      if (room.players.size === 0) {
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
