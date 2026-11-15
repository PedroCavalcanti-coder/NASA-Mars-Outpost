import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  GAME_MAX_PLAYERS,
  GAMEPLAY_VERSION,
  MOVEMENT_VERSION,
  NAVIGATION_HASH,
  neutralInput,
  navigationData,
  type MovementSnapshot,
  type GameClientToServer,
  type GameJoinResult,
  type GameServerToClient,
  normalizeSuit,
  worldClock,
} from '@mars/shared';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as persistence from '../worlds/service';
import { isNicknameTaken, registerGameNamespace } from './game';

vi.mock('../worlds/service', async (original) => {
  const actual = await original<typeof import('../worlds/service')>();
  return {
    ...actual,
    loadWorld: vi.fn(),
    ownerFromCookies: vi.fn(),
    purgeExpired: vi.fn(),
    touchLink: vi.fn(),
    saveWorld: vi.fn(),
  };
});

type Client = Socket<GameServerToClient, GameClientToServer>;
const suit = normalizeSuit({});
const request = (name: string, code = 'TEST', base = 'jezero') => ({
  code,
  base,
  name,
  suit,
  gameplayVersion: GAMEPLAY_VERSION,
  movementVersion: MOVEMENT_VERSION,
  navigationHash: NAVIGATION_HASH,
});
const motion = { x: 1, z: 2, h: 0, m: 'walk' as const };
const event = (id = 'drill', sol = 1) => ({
  eid: `test-${id}`,
  id,
  sol,
  by: 'forjado',
  title: 'Missão',
  text: 'Concluída',
  deltas: { research: 2 },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('salas multiplayer com clientes reais', () => {
  let http: HttpServer;
  let server: Server;
  let url: string;
  let clients: Client[];
  beforeEach(async () => {
    vi.mocked(persistence.loadWorld).mockReset().mockResolvedValue(null);
    vi.mocked(persistence.ownerFromCookies).mockReset().mockResolvedValue(null);
    vi.mocked(persistence.purgeExpired).mockResolvedValue(undefined);
    vi.mocked(persistence.touchLink).mockReset().mockResolvedValue(undefined);
    vi.mocked(persistence.saveWorld).mockResolvedValue(undefined);
    clients = [];
    http = createServer();
    server = new Server(http, { maxHttpBufferSize: 16 * 1024 });
    registerGameNamespace(server);
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}/game`;
  });
  afterEach(async () => {
    for (const c of clients) c.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.restoreAllMocks();
  });
  async function client(transport = 'websocket') {
    const socket: Client = connect(url, {
      transports: [transport],
      forceNew: true,
      reconnection: false,
    });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }
  async function join(c: Client, name: string, code = 'TEST', base = 'jezero') {
    return c.timeout(2000).emitWithAck('room:join', request(name, code, base));
  }
  function success(r: Awaited<ReturnType<typeof join>>): GameJoinResult {
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    return r;
  }

  it('reserva quatro vagas únicas mesmo em entradas simultâneas e recusa a quinta', async () => {
    const group = await Promise.all(Array.from({ length: 5 }, client));
    const replies = await Promise.all(group.map((c, i) => join(c, `Astro ${i}`)));
    const accepted = replies.filter((r) => r.ok);
    expect(accepted).toHaveLength(GAME_MAX_PLAYERS);
    expect(new Set(accepted.map((r) => r.ok && r.self.slot))).toEqual(new Set([0, 1, 2, 3]));
    expect(replies.filter((r) => !r.ok)).toEqual([
      expect.objectContaining({ error: expect.stringContaining('cheia') }),
    ]);
    expect(persistence.loadWorld).toHaveBeenCalledTimes(1);
  });

  it('compara apelidos sem acento/caixa e isola salas diferentes', async () => {
    const a = await client();
    const b = await client();
    const c = await client();
    success(await join(a, 'Cáio'));
    expect(await join(b, 'caio')).toMatchObject({
      ok: false,
      error: expect.stringContaining('apelido'),
    });
    success(await join(c, 'Caio', 'OTHER'));
    expect(isNicknameTaken('TEST', 'CAIO')).toBe(true);
  });

  it('recusa outra base e devolve a base certa sem anunciar um jogador fantasma', async () => {
    const a = await client();
    const b = await client();
    success(await join(a, 'Astro A'));
    const joined = vi.fn();
    a.on('player:joined', joined);
    expect(await join(b, 'Astro B', 'TEST', 'gale')).toMatchObject({ ok: false, baseId: 'jezero' });
    expect(joined).not.toHaveBeenCalled();
    success(await join(b, 'Astro B'));
  });

  it('impede que o mesmo socket entre duas vezes enquanto consulta o banco', async () => {
    const gate = deferred<string | null>();
    vi.mocked(persistence.ownerFromCookies).mockReturnValueOnce(gate.promise);
    const a = await client();
    const first = join(a, 'Astro A');
    const second = await join(a, 'Astro B', 'OTHER');
    expect(second.ok).toBe(false);
    gate.resolve(null);
    success(await first);
    expect(isNicknameTaken('TEST', 'Astro A')).toBe(true);
    expect(isNicknameTaken('OTHER', 'Astro B')).toBe(false);
  });

  it('não cria um mundo vazio quando a leitura do salvamento falha', async () => {
    vi.mocked(persistence.loadWorld).mockRejectedValueOnce(new Error('banco fora do ar'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = await client();
    expect(await join(a, 'Astro A')).toMatchObject({
      ok: false,
      error: expect.stringContaining('consultar'),
    });
    success(await join(a, 'Astro A'));
    expect(persistence.loadWorld).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('não mantém astronautas que desconectaram enquanto a entrada estava pendente', async () => {
    const gate = deferred<Awaited<ReturnType<typeof persistence.loadWorld>>>();
    vi.mocked(persistence.loadWorld).mockReturnValueOnce(gate.promise);
    const a = await client();
    a.emit('room:join', request('Astro A'), () => {});
    await expect.poll(() => vi.mocked(persistence.loadWorld).mock.calls.length).toBe(1);
    a.disconnect();
    await expect.poll(() => server.of('/game').sockets.size).toBe(0);
    gate.resolve(null);
    const b = await client();
    const result = success(await join(b, 'Astro B'));
    expect(result.players).toHaveLength(0);
    expect(result.self.slot).toBe(0);
  });

  it('novos jogadores recebem posição, painéis e cultivo atuais; reconexão mantém o mundo', async () => {
    const a = await client();
    success(await join(a, 'Astro A'));
    a.emit('movement:action', 'ready', () => {});
    a.emit('movement:input', { ...neutralInput(1), direction: { x: 1, z: 0 } });
    a.emit('world:solar', [
      { index: 0, stage: 4 },
      { index: 1, stage: 3 },
    ]);
    a.emit('world:crops', [
      { index: 0, stage: 1 },
      { index: 1, stage: 3 },
    ]);
    const b = await client();
    const result = success(await join(b, 'Astro B'));
    expect(result.players[0]?.motion).toMatchObject({
      x: expect.any(Number),
      z: expect.any(Number),
    });
    expect(result.world.solar.slice(0, 2)).toEqual([4, 3]);
    expect(result.world.crops).toEqual([1, 3]);
    a.disconnect();
    await expect.poll(() => isNicknameTaken('TEST', 'Astro A')).toBe(false);
    const reconnected = success(await join(await client(), 'Astro A'));
    expect(reconnected.world.crops).toEqual([1, 3]);
    expect(reconnected.players.map((p) => p.name)).toEqual(['Astro B']);
  });

  it('congela a sala vazia e retoma sem saltar o período sem jogadores', async () => {
    const realNow = Date.now;
    let offset = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    const a = await client();
    const first = success(await join(a, 'Astro A'));
    a.disconnect();
    await expect.poll(() => server.of('/game').sockets.size).toBe(0);
    offset = 90_000;
    const second = success(await join(await client(), 'Astro A'));
    expect(
      worldClock(second.world, second.serverNow).elapsedMs -
        worldClock(first.world, first.serverNow).elapsedMs,
    ).toBeLessThan(1500);
    expect(second.world.repairPause).toBeUndefined();
    expect(second.world.paused).not.toBe(true);
  });

  it('aceita só uma conclusão simultânea e anuncia a mesma recompensa para todos', async () => {
    const a = await client();
    const b = await client();
    success(await join(a, 'Astro A'));
    success(await join(b, 'Astro B'));
    const receivedA = vi.fn();
    const receivedB = vi.fn();
    a.on('mission:event', receivedA);
    b.on('mission:event', receivedB);
    const replies = await Promise.all([
      a.timeout(1000).emitWithAck('mission:event', event()),
      b.timeout(1000).emitWithAck('mission:event', { ...event(), eid: 'other-event' }),
    ]);
    expect(replies.filter((r) => r.ok)).toHaveLength(1);
    await expect.poll(() => receivedA.mock.calls.length).toBe(1);
    expect(receivedB).toHaveBeenCalledTimes(1);
    expect(receivedA.mock.calls[0]).toEqual(receivedB.mock.calls[0]);
    expect(receivedA.mock.calls[0]?.[0].by).toBe('Astro A');
    expect(await a.timeout(1000).emitWithAck('mission:event', event('garden', 999))).toMatchObject({
      ok: false,
    });
  });

  it('tráfego de movimento não esgota as fichas das ações importantes', async () => {
    const a = await client();
    success(await join(a, 'Astro A'));
    for (let i = 0; i < 150; i++) a.emit('player:state', motion);
    expect(await a.timeout(2000).emitWithAck('mission:event', event())).toMatchObject({ ok: true });
  });

  it('não espera a renovação do vínculo para confirmar uma entrada', async () => {
    vi.mocked(persistence.loadWorld).mockResolvedValue({
      baseId: 'jezero',
      save: { v: 2, elapsedMs: 0, solar: [], crops: [] },
      savedAt: new Date(),
    });
    vi.mocked(persistence.ownerFromCookies).mockResolvedValue('owner');
    vi.mocked(persistence.touchLink).mockReturnValue(new Promise(() => {}));
    const result = success(await join(await client(), 'Astro A'));
    expect(result.persistence).toMatchObject({ linked: true, canSave: true });
  });

  it('recusa restauração se alguém entra enquanto o banco responde', async () => {
    vi.mocked(persistence.loadWorld).mockResolvedValue({
      baseId: 'jezero',
      save: { v: 2, elapsedMs: 0, solar: [], crops: [] },
      savedAt: new Date(),
    });
    vi.mocked(persistence.ownerFromCookies).mockResolvedValue('owner');
    const a = await client();
    success(await join(a, 'Astro A'));
    const gate = deferred<Awaited<ReturnType<typeof persistence.loadWorld>>>();
    vi.mocked(persistence.loadWorld).mockReturnValueOnce(gate.promise);
    const restore = a.timeout(2000).emitWithAck('world:restore');
    await expect.poll(() => vi.mocked(persistence.loadWorld).mock.calls.length).toBe(2);
    const b = await client();
    success(await join(b, 'Astro B'));
    gate.resolve({
      baseId: 'jezero',
      save: { v: 2, elapsedMs: 0, solar: [], crops: [] },
      savedAt: new Date(),
    });
    expect(await restore).toMatchObject({
      ok: false,
      error: expect.stringContaining('tripulação mudou'),
    });
  });

  it('mescla mudanças simultâneas em painéis e canteiros diferentes sem apagar o colega', async () => {
    const a = await client();
    const b = await client();
    success(await join(a, 'Astro A'));
    success(await join(b, 'Astro B'));
    a.emit('world:solar', [{ index: 0, stage: 4 }]);
    b.emit('world:solar', [{ index: 1, stage: 3 }]);
    a.emit('world:crops', [{ index: 0, stage: 2 }]);
    b.emit('world:crops', [{ index: 1, stage: 3 }]);
    a.emit('world:care', { filter: 1 });
    b.emit('world:care', { crops: [{ index: 0, sol: 1, needsCare: false }] });
    // ACKs no mesmo transporte garantem que os comandos anteriores chegaram.
    await Promise.all([
      a.timeout(1000).emitWithAck('mission:event', event()),
      b.timeout(1000).emitWithAck('mission:event', event('garden')),
    ]);
    const state = success(await join(await client(), 'Astro C')).world;
    expect(state.solar.slice(0, 2)).toEqual([4, 3]);
    expect(state.crops).toEqual([2, 3]);
    expect(state.care).toMatchObject({ filter: 1, crops: [1] });
  });

  it('recusa embarque remoto sem proximidade e devolve o mesmo snapshot ao solicitante', async () => {
    const a = await client();
    const joined = success(await join(a, 'Astro A'));
    await a.timeout(1000).emitWithAck('movement:action', 'ready');
    const result = await a.timeout(1000).emitWithAck('movement:action', 'enter');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('perto');
    expect(result.snapshot.rover.driver).toBeNull();
    expect(result.snapshot.players[0]?.id).toBe(joined.self.id);
  });

  it('reconecta sem conflito de apelido quando a conexão antiga ainda não expirou', async () => {
    const a = await client();
    const b = await client();
    const resumeToken = 'ab'.repeat(24);
    const original = success(
      await a.timeout(1000).emitWithAck('room:join', { ...request('Astro A'), resumeToken }),
    );
    success(await join(b, 'Astro B'));
    await a.timeout(1000).emitWithAck('movement:action', 'ready');
    const originalState = (
      await a.timeout(1000).emitWithAck('movement:action', 'ready')
    ).snapshot.players.find((p: MovementSnapshot['players'][number]) => p.id === a.id)!.state;
    await a.timeout(1000).emitWithAck('mission:event', event());
    const c = await client();
    const resumed = success(
      await c.timeout(1000).emitWithAck('room:join', { ...request('Astro A'), resumeToken }),
    );
    expect(resumed.self.slot).toBe(original.self.slot);
    expect(resumed.players.map((p) => p.name)).toEqual(['Astro B']);
    expect(resumed.players.some((p) => 'resumeToken' in p)).toBe(false);
    await expect.poll(() => a.connected).toBe(false);
    const d = success(await join(await client(), 'Astro D'));
    expect(d.players.find((p) => p.id === resumed.self.id)?.motion).toMatchObject({
      x: originalState.x,
      z: originalState.z,
    });
  });

  it.each(['websocket', 'polling'])(
    'publica snapshots canônicos completos inclusive para o autor por %s',
    async (transport) => {
      const a = await client(transport),
        b = await client(transport);
      success(await join(a, 'Astro A'));
      success(await join(b, 'Astro B'));
      const receivedA: MovementSnapshot[] = [],
        receivedB: MovementSnapshot[] = [];
      a.on('movement:snapshot', (s) => receivedA.push(s));
      b.on('movement:snapshot', (s) => receivedB.push(s));
      await a.timeout(1000).emitWithAck('movement:action', 'ready');
      a.emit('movement:input', { ...neutralInput(1), direction: { x: 1, z: 0 } });
      await expect
        .poll(() =>
          receivedA.some((s) => s.players.find((p) => p.id === a.id)?.state.lastSeq === 1),
        )
        .toBe(true);
      await expect
        .poll(() =>
          receivedB.some((s) => s.players.find((p) => p.id === a.id)?.state.lastSeq === 1),
        )
        .toBe(true);
      const shared = receivedA.find((s) =>
        receivedB.some((t) => t.tick === s.tick && t.serverNow === s.serverNow),
      );
      expect(shared).toBeDefined();
      expect(receivedB).toContainEqual(shared);
      expect(shared?.players).toHaveLength(2);
    },
  );

  it('recusa versões de protocolo e geometria incompatíveis', async () => {
    const a = await client();
    const r = await a
      .timeout(1000)
      .emitWithAck('room:join', { ...request('Astro A'), navigationHash: 'old' });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('Atualize') });
  });

  it('aplica o dano global do evento uma vez pelo coordenador', async () => {
    const a = await client();
    const b = await client();
    success(await join(a, 'Astro A'));
    success(await join(b, 'Astro B'));
    const [first, second] = await Promise.all([
      a.timeout(1000).emitWithAck('world:repair', { op: 'damage', amount: 20 }),
      b.timeout(1000).emitWithAck('world:repair', { op: 'damage', amount: 20 }),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    const state = success(await join(await client(), 'Astro C'));
    expect(state.world.integrity?.fractures.reduce((n, f) => n + f.damage, 0)).toBe(20);
  });

  it('ignora movimento inválido e não vaza chat, estados ou emojis para outra sala', async () => {
    const a = await client();
    const b = await client();
    success(await join(a, 'Astro A'));
    success(await join(b, 'Astro B', 'OTHER'));
    const states = vi.fn();
    const chats = vi.fn();
    b.on('player:state', states);
    b.on('player:chat', chats);
    a.emit('player:state', { ...motion, x: 99999 });
    a.emit('player:chat', 'Olá!');
    a.emit('player:emote', -1);
    const check = success(await join(await client(), 'Astro C'));
    expect(check.players[0]?.motion).toMatchObject({ x: navigationData('jezero').spawns[0]!.x });
    expect(states).not.toHaveBeenCalled();
    expect(chats).not.toHaveBeenCalled();
  });
});
