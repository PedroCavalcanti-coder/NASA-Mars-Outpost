import { createGameplay } from '@mars/sim';
// @vitest-environment happy-dom
import {
  type GameJoinResult,
  type GameMissionEvent,
  newIntegrity,
  newMovement,
  navigationData,
  normalizeSuit,
} from '@mars/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MultiplayerRoom,
  RoomBaseMismatchError,
  RoomConnectionError,
  RoomRejectedError,
} from './MultiplayerRoom';

const fixture = vi.hoisted(() => ({ sockets: [] as FakeSocket[], io: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: fixture.io }));
class FakeSocket {
  connected = false;
  sendBuffer: unknown[] = [];
  handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  emit = vi.fn();
  emitWithAck = vi.fn();
  disconnect = vi.fn(() => {
    this.connected = false;
    return this;
  });
  removeAllListeners = vi.fn(() => this.handlers.clear());
  volatile = { emit: this.emit };
  timeout() {
    return this;
  }
  on(event: string, callback: (...args: unknown[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]);
    return this;
  }
  fire(event: string, ...args: unknown[]) {
    if (event === 'connect') this.connected = true;
    if (event === 'disconnect') this.connected = false;
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
  joined(result = snapshot()) {
    this.fire('connect');
    [...this.emit.mock.calls]
      .reverse()
      .find((call) => call[0] === 'room:join')?.[2](null, { ok: true, ...result });
  }
}
const suit = normalizeSuit({});
const options = { roomCode: 'TEST', baseId: 'jezero', name: 'Caio', suit };
const player = (id: string, slot = 1) => ({ id, slot, name: id, suit });
const motion = { x: 4, z: 6, h: 0, m: 'walk' as const };
const mission: GameMissionEvent = {
  eid: 'event-test',
  id: 'drill',
  sol: 1,
  by: 'Caio',
  title: 'Sondagem',
  text: 'Feito',
  deltas: { research: 2 },
};
function snapshot(): GameJoinResult {
  return {
    gameplay: {version:1,serverNow:Date.now(),state:createGameplay(1,'test',[0,0],[1,1])},
    movement: {
      tick: 0,
      serverNow: Date.now(),
      scale: 1,
      players: [
        {
          id: 'self',
          state: newMovement(navigationData('jezero').spawns[0]!),
          inside: false,
          room: null,
        },
      ],
      rover: { ...newMovement(navigationData('jezero').park), driver: null, rider: null },
    },
    baseId: 'jezero',
    self: player('self', 0),
    players: [player('other')],
    world: { clockStart: Date.now(), storm: 0, solar: [0, 0], crops: [1, 1] },
    serverNow: Date.now(),
    persistence: { linked: false, canSave: false },
  };
}
let rooms: MultiplayerRoom[];
beforeEach(() => {
  fixture.sockets = [];
  fixture.io.mockReset().mockImplementation(() => {
    const socket = new FakeSocket();
    fixture.sockets.push(socket);
    return socket;
  });
  rooms = [];
});
afterEach(() => {
  for (const room of rooms) room.dispose();
  vi.useRealTimers();
});
async function joined() {
  const pending = MultiplayerRoom.join(options);
  const socket = fixture.sockets.at(-1)!;
  socket.joined();
  const room = await pending;
  rooms.push(room);
  return { room, socket };
}

describe('MultiplayerRoom', () => {
  it('não inventa uma sala local quando o servidor está indisponível e fecha o socket', async () => {
    vi.useFakeTimers();
    const channel = vi.spyOn(globalThis, 'BroadcastChannel');
    const pending = MultiplayerRoom.join(options);
    const check = expect(pending).rejects.toBeInstanceOf(RoomConnectionError);
    await vi.advanceTimersByTimeAsync(12_000);
    await check;
    expect(fixture.sockets[0]?.disconnect).toHaveBeenCalledOnce();
    expect(channel).not.toHaveBeenCalled();
    channel.mockRestore();
  });

  it('fecha a conexão ao recusar entrada e identifica a base correta', async () => {
    const pending = MultiplayerRoom.join(options);
    const socket = fixture.sockets[0]!;
    socket.fire('connect');
    socket.emit.mock.calls[0]?.[2](null, { ok: false, error: 'Outra base', baseId: 'gale' });
    await expect(pending).rejects.toMatchObject({ baseId: 'gale' });
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(new RoomBaseMismatchError('gale')).toBeInstanceOf(RoomRejectedError);
  });

  it('aguarda a confirmação da sala antes de marcar a conexão como pronta', async () => {
    const pending = MultiplayerRoom.join(options);
    const socket = fixture.sockets[0]!;
    socket.fire('connect');
    expect(socket.emit).toHaveBeenCalledWith(
      'room:join',
      expect.objectContaining({ code: 'TEST' }),
      expect.any(Function),
    );
    socket.emit.mock.calls[0]?.[2](null, { ok: true, ...snapshot() });
    const room = await pending;
    rooms.push(room);
    expect(room.connected).toBe(true);
    expect(room.status).toBe('connected');
  });

  it('reconcilia posição, roster e todo o mundo ao reconectar', async () => {
    const { room, socket } = await joined();
    const callbacks = {
      time: vi.fn(),
      crops: vi.fn(),
      care: vi.fn(),
      solar: vi.fn(),
      vehicle: vi.fn(),
      storm: vi.fn(),
      integrity: vi.fn(),
      state: vi.fn(),
      joined: vi.fn(),
      status: vi.fn(),
    };
    room.onTime = callbacks.time;
    room.onCrops = callbacks.crops;
    room.onCare = callbacks.care;
    room.onSolar = callbacks.solar;
    room.onVehicle = callbacks.vehicle;
    room.onStorm = callbacks.storm;
    room.onIntegrity = callbacks.integrity;
    room.onPlayerState = callbacks.state;
    room.onPlayerJoined = callbacks.joined;
    room.onStatus = callbacks.status;
    socket.fire('disconnect');
    expect(room.connected).toBe(false);
    expect(room.isCoordinator).toBe(false);
    const current = snapshot();
    current.self.id = 'new-self';
    current.players = [{ ...player('other'), motion }];
    current.world = {
      ...current.world,
      solar: [4, 3],
      crops: [3, 2],
      storm: 0.8,
      care: { crops: [1, 1], filter: 1 },
      vehicle: { x: 5, z: 6, h: 0 },
      integrity: newIntegrity(),
      paused: true,
      timeScale: 2,
    };
    socket.joined(current);
    expect(room.self.id).toBe('new-self');
    expect(room.remotes.get('other')?.motion).toEqual(motion);
    expect(callbacks.state).toHaveBeenCalledWith('other', motion);
    expect(callbacks.joined).not.toHaveBeenCalled();
    expect(callbacks.crops).toHaveBeenCalledWith([3, 2]);
    expect(callbacks.solar).toHaveBeenCalledWith([4, 3]);
    expect(callbacks.care).toHaveBeenCalledWith(current.world.care);
    expect(callbacks.vehicle).toHaveBeenCalledWith(current.world.vehicle);
    expect(callbacks.integrity).toHaveBeenCalledWith(current.world.integrity);
    expect(callbacks.time).toHaveBeenCalledWith(
      expect.objectContaining({ paused: true, scale: 2 }),
    );
    expect(callbacks.status.mock.calls.map((call) => call[0])).toEqual([
      'reconnecting',
      'connected',
    ]);
  });

  it('congela o relógio local durante a queda para não executar viradas de Sol isoladas', async () => {
    vi.useFakeTimers();
    const { room, socket } = await joined();
    socket.fire('disconnect');
    const clock = room.clock();
    await vi.advanceTimersByTimeAsync(900_000);
    expect(room.clock()).toEqual(clock);
  });

  it('avisa e encerra quando uma reconexão é recusada', async () => {
    const { room, socket } = await joined();
    const error = vi.fn();
    room.onError = error;
    socket.fire('disconnect');
    socket.fire('connect');
    socket.emit.mock.calls.at(-1)?.[2](null, { ok: false, error: 'Sala cheia' });
    expect(room.status).toBe('failed');
    expect(room.connected).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.any(RoomRejectedError));
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it('não enfileira ações nem altera o snapshot durante queda ou depois de sair', async () => {
    const { room, socket } = await joined();
    socket.fire('disconnect');
    socket.emit.mockClear();
    room.sendSolar([4, 4]);
    room.sendCrops([3, 3]);
    room.sendCare({ crops: [1], filter: 1 });
    room.sendChat('Olá');
    room.sendTime({ paused: true, scale: 1 });
    room.sendState(motion);
    expect(await room.sendMission(mission)).toBe(false);
    expect(await room.requestRepair({ op: 'ready' })).toBe(false);
    expect((await room.save()).ok).toBe(false);
    expect(room.world.solar).toEqual([0, 0]);
    expect(socket.emit).not.toHaveBeenCalled();
    room.dispose();
    room.sendVehicle({ x: 1, z: 1, h: 0 });
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('só aplica a recompensa confirmada uma vez, inclusive para quem concluiu', async () => {
    const { room, socket } = await joined();
    const received = vi.fn();
    room.onMissionEvent = received;
    let confirm!: (value: { ok: boolean }) => void;
    socket.emitWithAck.mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const pending = room.sendMission(mission);
    expect(room.board).toBeUndefined();
    expect(await room.sendMission({ ...mission, eid: 'duplicate-test' })).toBe(false);
    socket.fire('mission:event', mission);
    socket.fire('mission:event', mission);
    confirm({ ok: true });
    expect(await pending).toBe(true);
    expect(received).toHaveBeenCalledExactlyOnceWith(mission, true);
    expect(room.board?.done).toEqual(['drill']);
  });

  it('missão recusada não altera o quadro nem concede recompensa local', async () => {
    const { room, socket } = await joined();
    const received = vi.fn();
    room.onMissionEvent = received;
    socket.emitWithAck.mockResolvedValue({ ok: false, error: 'Já concluída' });
    expect(await room.sendMission(mission)).toBe(false);
    expect(room.board).toBeUndefined();
    expect(received).not.toHaveBeenCalled();
  });

  it('aplica o lote de posições do polling e ignora jogadores que já saíram', async () => {
    const { room, socket } = await joined();
    const received = vi.fn();
    room.onPlayerState = received;
    socket.fire('players:states', [
      { id: 'other', motion },
      { id: 'gone', motion },
    ]);
    expect(room.remotes.get('other')?.motion).toEqual(motion);
    expect(received).toHaveBeenCalledExactlyOnceWith('other', motion);
  });

  it('publica apenas os índices alterados e não transmite estados repetidos', async () => {
    const { room, socket } = await joined();
    socket.emit.mockClear();
    room.sendSolar([4, 0]);
    room.sendSolar([4, 0]);
    room.sendCrops([1, 3]);
    expect(socket.emit.mock.calls).toEqual([
      ['world:solar', [{ index: 0, stage: 4 }]],
      ['world:crops', [{ index: 1, stage: 3 }]],
    ]);
  });
});
