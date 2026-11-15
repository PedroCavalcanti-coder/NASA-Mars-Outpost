import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { io } from 'socket.io-client';

// Temporary room only; no accounts or saved worlds are modified.
const origin = process.argv[2] ?? 'http://127.0.0.1:5173';
const transport = process.argv[3] ?? 'websocket';
const navigationHash = /NAVIGATION_HASH = '([^']+)'/.exec(
  readFileSync(new URL('../packages/shared/src/navigationData.ts', import.meta.url), 'utf8'),
)[1];
const version = { movementVersion: 2, navigationHash, gameplayVersion: 1 };
const code = `QA-${Date.now().toString(36).toUpperCase()}`;
const clients = [],
  snapshots = [],
  latency = [],
  sentAt = new Map();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  for (let index = 0; index < 5; index++) {
    const socket = io(`${origin}/game`, {
      transports: transport === 'polling' ? ['polling'] : ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    clients.push(socket);
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    const result = await socket.timeout(12000).emitWithAck('room:join', {
      ...version,
      code,
      base: 'jezero',
      name: `QA Astro ${index}`,
      suit: {},
    });
    assert.equal(result.ok, index < 4, result.error);
    if (index === 4) {
      socket.disconnect();
      break;
    }
    assert.equal(result.self.slot, index);
    snapshots[index] = result.movement;
    socket.on('movement:snapshot', (state) => {
      snapshots[index] = state;
      const own = state.players.find((p) => p.id === socket.id);
      const key = `${socket.id}:${own?.state.lastSeq}`;
      if (sentAt.has(key)) {
        latency.push(performance.now() - sentAt.get(key));
        sentAt.delete(key);
      }
    });
    if (result.gameplay) {
      const ready = await socket
        .timeout(3000)
        .emitWithAck('game:command', {
          version: 1,
          operationId: '1',
          generation: result.gameplay.state.generation,
          payload: { type: 'ready' },
        });
      assert.equal(ready.ok, true);
    }
    assert.equal((await socket.timeout(3000).emitWithAck('movement:action', 'ready')).ok, true);
  }
  for (let seq = 1; seq <= 60; seq++) {
    for (const socket of clients.slice(0, 4)) {
      sentAt.set(`${socket.id}:${seq}`, performance.now());
      socket.emit('movement:input', {
        seq,
        direction: seq <= 30 ? { x: 1, z: 0 } : null,
        destination: null,
        manual: null,
        sleeping: false,
        speedScale: 1,
        exitBlocked: false,
        activity: 'idle',
        face: 0,
      });
    }
    await wait(1000 / 30);
  }
  await wait(600);
  const reference = snapshots[0];
  for (const state of snapshots) {
    assert.equal(state.players.length, 4);
    for (const p of state.players) {
      const canonical = reference.players.find((q) => q.id === p.id);
      assert.ok(p.state.lastSeq >= 40, 'Input acknowledgements stopped');
      assert.ok(Math.hypot(p.state.x - canonical.state.x, p.state.z - canonical.state.z) < 0.05);
      assert.equal(p.state.m, 'idle');
    }
  }
  latency.sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        origin,
        transport,
        players: 4,
        authority: 'server',
        allClientsConverged: true,
        tolerance: 0.05,
        roomFullRejected: true,
        confirmations: latency.length,
        confirmationLatencyMs: {
          p50: latency[Math.floor(latency.length * 0.5)],
          p95: latency[Math.floor(latency.length * 0.95)],
        },
      },
      null,
      2,
    ),
  );
} finally {
  for (const socket of clients) socket.disconnect();
}
