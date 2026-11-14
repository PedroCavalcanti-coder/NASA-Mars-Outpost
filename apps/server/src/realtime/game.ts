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
  normalizeSuit,
} from '@mars/shared';
import type { Namespace } from 'socket.io';

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
  refillAt: number;
}

interface Room {
  code: string;
  players: Map<string, { info: GamePlayerInfo; motion?: GameMotion }>;
  world: GameWorldState;
  cleanup?: NodeJS.Timeout;
}

type GameNs = Namespace<GameClientToServer, GameServerToClient, Record<string, never>, SocketData>;

const MAX_ROOMS = 500;
/** limite do mundo: nada que se mova pode estar além disso (unidades de mundo) */
const WORLD_LIMIT = 200;
const STATE_RATE = 40; // mensagens por segundo
const rooms = new Map<string, Room>();

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

  ns.on('connection', (socket) => {
    socket.data.tokens = STATE_RATE;
    socket.data.refillAt = Date.now();

    socket.on('room:join', (raw, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (socket.data.room) return reply({ ok: false, error: 'Você já está numa sala' });
      if (!takeToken(socket.data, 10)) return reply({ ok: false, error: 'Calma!' });

      const req = (raw ?? {}) as unknown as Record<string, unknown>;
      const code = typeof req.code === 'string' ? req.code.trim().toUpperCase() : '';
      if (!GAME_ROOM_CODE_RE.test(code))
        return reply({ ok: false, error: 'Código de sala inválido' });

      let room = rooms.get(code);
      if (!room) {
        if (rooms.size >= MAX_ROOMS) return reply({ ok: false, error: 'Servidor cheio' });
        const now = Date.now();
        room = {
          code,
          players: new Map(),
          world: {
            // a sala "nasce" às 09:00 do Sol 1
            clockStart: now,
            storm: 0,
            solar: new Array<number>(GAME_MAX_SOLAR).fill(0),
            crops: [],
          },
        };
        rooms.set(code, room);
      }
      if (room.cleanup) {
        clearTimeout(room.cleanup);
        room.cleanup = undefined;
      }
      if (room.players.size >= GAME_MAX_PLAYERS) {
        return reply({ ok: false, error: `Sala cheia (máx. ${GAME_MAX_PLAYERS} astronautas)` });
      }

      const used = new Set([...room.players.values()].map((p) => p.info.slot));
      let slot = 0;
      while (used.has(slot)) slot++;

      const info: GamePlayerInfo = {
        id: socket.id,
        name: cleanName(req.name),
        suit: normalizeSuit(req.suit),
        slot,
      };
      const others = [...room.players.values()].map((p) => ({ ...p.info, motion: p.motion }));
      room.players.set(socket.id, { info });
      socket.data.room = code;
      socket.data.info = info;
      void socket.join(code);
      socket.to(code).emit('player:joined', info);

      reply({
        ok: true,
        self: info,
        players: others,
        world: room.world,
        serverNow: Date.now(),
      });
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
      if (room.players.size === 0) {
        // mantém o mundo por 2 min: quem cai e volta reencontra a mesma partida
        room.cleanup = setTimeout(() => rooms.delete(room.code), 2 * 60_000);
        room.cleanup.unref();
      }
    });
  });
}
