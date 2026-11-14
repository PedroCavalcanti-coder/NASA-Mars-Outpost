import {
  GAME_MAX_PLAYERS,
  GAME_MAX_SOLAR,
  GAME_NAMESPACE,
  GAME_START_HOUR,
  type GameClientToServer,
  type GameMotion,
  type GamePlayerInfo,
  type GamePlayerState,
  type GameServerToClient,
  type GameVehicleState,
  type GameWorldState,
  gameClock,
  type SuitConfig,
} from '@mars/shared';
import { io, type Socket } from 'socket.io-client';

/** Onde a sala está rodando: no servidor (qualquer dispositivo) ou só entre abas deste navegador. */
export type RoomMode = 'online' | 'local';

export interface RoomJoinOptions {
  roomCode: string;
  baseId: string;
  name: string;
  suit: SuitConfig;
}

export interface RemotePlayer extends GamePlayerInfo {
  motion?: GameMotion;
}

type GameSocket = Socket<GameServerToClient, GameClientToServer>;

/** Vazio = mesma origem (proxy do Vite em desenvolvimento). */
const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? '';
const JOIN_TIMEOUT_MS = 3500;

/**
 * Sala multiplayer (até 4 astronautas). O servidor é só um relé: cada jogador é "dono" do
 * próprio astronauta e publica seu estado (posição, direção, ação); os demais interpolam.
 * Relógio, tempestade e painéis solares fazem parte do estado compartilhado da sala.
 *
 * Se o servidor não responder, cai para um modo local (BroadcastChannel) que sincroniza
 * as abas do mesmo navegador, útil para testar sem backend.
 */
export class MultiplayerRoom {
  mode: RoomMode = 'online';
  self!: GamePlayerInfo;
  world: GameWorldState = {
    clockStart: Date.now(),
    storm: 0,
    solar: new Array<number>(GAME_MAX_SOLAR).fill(0),
    crops: [],
  };

  /** quem já conhecemos (sem nós mesmos) */
  readonly remotes = new Map<string, RemotePlayer>();

  onPlayerJoined?: (p: RemotePlayer, existing: boolean) => void;
  onPlayerLeft?: (id: string) => void;
  onPlayerState?: (id: string, s: GameMotion) => void;
  onStorm?: (value: number) => void;
  onSolar?: (stages: number[]) => void;
  onCrops?: (stages: number[]) => void;
  onEmote?: (id: string, emote: number) => void;
  onVehicle?: (v: GameVehicleState) => void;
  onStatus?: (status: 'connected' | 'reconnecting') => void;

  private socket: GameSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private disposed = false;
  /** diferença entre o relógio do servidor e o local (ms) */
  private clockOffset = 0;
  private lastJoin: RoomJoinOptions | null = null;

  private constructor() {}

  /** Entra na sala. Nunca rejeita: sem servidor, usa o modo local. */
  static async join(opts: RoomJoinOptions): Promise<MultiplayerRoom> {
    const room = new MultiplayerRoom();
    room.lastJoin = opts;
    try {
      await room.joinOnline(opts);
    } catch (err) {
      if (err instanceof RoomFullError) throw err;
      room.teardownSocket();
      await room.joinLocal(opts);
    }
    return room;
  }

  /** Hora do dia e Sol atuais, iguais para todos na sala. */
  clock() {
    return gameClock(this.world.clockStart, Date.now() + this.clockOffset);
  }

  // ------------------------------------------------------------------ online (Socket.IO)

  private joinOnline(opts: RoomJoinOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const socket: GameSocket = io(`${SOCKET_URL}${GAME_NAMESPACE}`, {
        transports: ['websocket'],
        timeout: JOIN_TIMEOUT_MS,
        reconnectionDelayMax: 3000,
      });
      this.socket = socket;
      let settled = false;
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        reject(e);
      };
      const timer = window.setTimeout(() => fail(new Error('timeout')), JOIN_TIMEOUT_MS + 500);

      const doJoin = () => {
        socket.emit(
          'room:join',
          { code: opts.roomCode, name: opts.name, suit: opts.suit, base: opts.baseId },
          (r) => {
            if (!r.ok) {
              window.clearTimeout(timer);
              return fail(/cheia/i.test(r.error) ? new RoomFullError(r.error) : new Error(r.error));
            }
            this.self = r.self;
            this.world = r.world;
            this.clockOffset = r.serverNow - Date.now();
            this.applyRoster(r.players);
            this.onStatus?.('connected');
            if (!settled) {
              settled = true;
              window.clearTimeout(timer);
              resolve();
            }
          },
        );
      };

      socket.on('connect', doJoin);
      socket.on('connect_error', () => fail(new Error('connect_error')));
      socket.on('disconnect', () => {
        if (!this.disposed) this.onStatus?.('reconnecting');
      });
      socket.on('player:joined', (p) => this.addRemote(p, undefined, false));
      socket.on('player:left', (id) => this.removeRemote(id));
      socket.on('player:state', (id, s) => {
        const r = this.remotes.get(id);
        if (r) r.motion = s;
        this.onPlayerState?.(id, s);
      });
      socket.on('world:storm', (v) => {
        this.world.storm = v;
        this.onStorm?.(v);
      });
      socket.on('player:emote', (id, emote) => this.onEmote?.(id, emote));
      socket.on('world:crops', (stages) => {
        this.world.crops = stages;
        this.onCrops?.(stages);
      });
      socket.on('world:vehicle', (v) => {
        this.world.vehicle = v;
        this.onVehicle?.(v);
      });
      socket.on('world:solar', (stages) => {
        this.world.solar = stages;
        this.onSolar?.(stages);
      });
    });
  }

  private teardownSocket() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Concilia a lista da sala (entrada inicial ou reconexão) com quem já conhecemos. */
  private applyRoster(players: GamePlayerState[]) {
    const ids = new Set(players.map((p) => p.id));
    for (const id of [...this.remotes.keys()]) if (!ids.has(id)) this.removeRemote(id);
    for (const p of players) {
      if (!this.remotes.has(p.id)) this.addRemote(p, p.motion, true);
    }
  }

  private addRemote(p: GamePlayerInfo, motion: GameMotion | undefined, existing: boolean) {
    if (p.id === this.self?.id || this.remotes.has(p.id)) return;
    if (this.remotes.size >= GAME_MAX_PLAYERS - 1) return;
    const remote: RemotePlayer = { ...p, motion };
    this.remotes.set(p.id, remote);
    this.onPlayerJoined?.(remote, existing);
  }

  private removeRemote(id: string) {
    if (!this.remotes.delete(id)) return;
    this.onPlayerLeft?.(id);
  }

  // ------------------------------------------------------------------ local (BroadcastChannel)

  private async joinLocal(opts: RoomJoinOptions): Promise<void> {
    this.mode = 'local';
    this.clockOffset = 0;
    const id = `local_${Math.random().toString(36).slice(2, 10)}`;
    const provisional: GamePlayerInfo = { id, name: opts.name, suit: opts.suit, slot: -1 };
    this.self = provisional;
    this.world = {
      clockStart: Date.now(),
      storm: 0,
      solar: new Array<number>(GAME_MAX_SOLAR).fill(0),
      crops: [],
    };

    if (typeof BroadcastChannel === 'undefined') {
      this.self = { ...provisional, slot: 0 };
      return;
    }

    const ch = new BroadcastChannel(`mars_outpost_room_${opts.roomCode}`);
    this.channel = ch;
    const known: GamePlayerState[] = [];
    let collecting = true;

    ch.onmessage = (e: MessageEvent<LocalMessage>) => {
      if (this.disposed) return;
      const m = e.data;
      if (!m || typeof m !== 'object' || m.from === this.self.id) return;
      switch (m.t) {
        case 'hello': {
          // alguém entrou: responde com o que sabemos (se já temos vaga definida)
          if (this.self.slot < 0) return;
          this.post({
            t: 'hi',
            from: this.self.id,
            to: m.from,
            info: this.self,
            world: this.world,
            motion: this.localMotion,
          });
          break;
        }
        case 'hi':
          if (m.to !== this.self.id || !collecting) return;
          known.push({ ...m.info, motion: m.motion });
          // o relógio mais antigo vence: todos concordam no mesmo "início"
          this.world = {
            ...this.world,
            clockStart: Math.min(this.world.clockStart, m.world.clockStart),
            storm: m.world.storm,
            solar: m.world.solar,
            crops: m.world.crops,
            vehicle: m.world.vehicle,
          };
          break;
        case 'joined':
          this.addRemote(m.info, m.motion, false);
          break;
        case 'bye':
          this.removeRemote(m.from);
          break;
        case 'state': {
          const r = this.remotes.get(m.from);
          if (r) r.motion = m.s;
          this.onPlayerState?.(m.from, m.s);
          break;
        }
        case 'storm':
          this.world.storm = m.v;
          this.onStorm?.(m.v);
          break;
        case 'emote':
          this.onEmote?.(m.from, m.i);
          break;
        case 'crops':
          this.world.crops = m.stages;
          this.onCrops?.(m.stages);
          break;
        case 'vehicle':
          this.world.vehicle = m.v;
          this.onVehicle?.(m.v);
          break;
        case 'solar':
          this.world.solar = m.stages;
          this.onSolar?.(m.stages);
          break;
      }
    };

    this.post({ t: 'hello', from: id });
    await new Promise((r) => window.setTimeout(r, 350));
    collecting = false;

    if (known.length >= GAME_MAX_PLAYERS) {
      this.disposeLocal();
      throw new RoomFullError(`Sala cheia (máx. ${GAME_MAX_PLAYERS} astronautas)`);
    }
    const used = new Set(known.map((p) => p.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    this.self = { ...provisional, slot };
    this.applyRoster(known);
    this.post({ t: 'joined', from: id, info: this.self });
  }

  private localMotion: GameMotion | undefined;

  private post(m: LocalMessage) {
    try {
      this.channel?.postMessage(m);
    } catch {
      /* canal fechado */
    }
  }

  private disposeLocal() {
    this.channel?.close();
    this.channel = null;
  }

  // ------------------------------------------------------------------ envio

  sendState(s: GameMotion) {
    if (this.disposed) return;
    this.localMotion = s;
    if (this.mode === 'online') this.socket?.volatile.emit('player:state', s);
    else this.post({ t: 'state', from: this.self.id, s });
  }

  sendStorm(v: number) {
    this.world.storm = v;
    if (this.mode === 'online') this.socket?.emit('world:storm', v);
    else this.post({ t: 'storm', from: this.self.id, v });
  }

  sendEmote(emote: number) {
    if (this.disposed) return;
    if (this.mode === 'online') this.socket?.emit('player:emote', emote);
    else this.post({ t: 'emote', from: this.self.id, i: emote });
  }

  sendCrops(stages: number[]) {
    this.world.crops = stages;
    if (this.mode === 'online') this.socket?.emit('world:crops', stages);
    else this.post({ t: 'crops', from: this.self.id, stages });
  }

  sendVehicle(v: GameVehicleState) {
    this.world.vehicle = v;
    if (this.mode === 'online') this.socket?.emit('world:vehicle', v);
    else this.post({ t: 'vehicle', from: this.self.id, v });
  }

  sendSolar(stages: number[]) {
    this.world.solar = stages;
    if (this.mode === 'online') this.socket?.emit('world:solar', stages);
    else this.post({ t: 'solar', from: this.self.id, stages });
  }

  /** Quem coordena a poeira dos painéis: o astronauta de menor vaga entre os presentes. */
  get isCoordinator() {
    let min = this.self.slot;
    for (const p of this.remotes.values()) min = Math.min(min, p.slot);
    return this.self.slot <= min;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.mode === 'local') {
      this.post({ t: 'bye', from: this.self.id });
      this.disposeLocal();
    }
    this.teardownSocket();
    this.remotes.clear();
  }

  /** Padrão de relógio para reaproveitar (hora inicial de uma sala nova). */
  static readonly START_HOUR = GAME_START_HOUR;
}

export class RoomFullError extends Error {}

type LocalMessage =
  | { t: 'hello'; from: string }
  | {
      t: 'hi';
      from: string;
      to: string;
      info: GamePlayerInfo;
      world: GameWorldState;
      motion?: GameMotion;
    }
  | { t: 'joined'; from: string; info: GamePlayerInfo; motion?: GameMotion }
  | { t: 'bye'; from: string }
  | { t: 'state'; from: string; s: GameMotion }
  | { t: 'storm'; from: string; v: number }
  | { t: 'solar'; from: string; stages: number[] }
  | { t: 'crops'; from: string; stages: number[] }
  | { t: 'emote'; from: string; i: number }
  | { t: 'vehicle'; from: string; v: GameVehicleState };
