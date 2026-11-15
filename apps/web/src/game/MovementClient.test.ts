import { MOVEMENT_DT, type MovementInput, mapDirection, neutralInput } from '@mars/shared';
import { describe, expect, it, vi } from 'vitest';
import { RoomMovement } from '../../../server/src/realtime/movement';
import { MovementClient } from './MovementClient';

describe('previsão e snapshots de movimento', () => {
  it.each([0, 50, 150, 300])(
    'converge com atraso de %i ms, reordenação e perda de snapshots',
    (latency) => {
      const room = new RoomMovement('jezero');
      room.join('a', 0, undefined, 0);
      room.action('a', 'ready');
      room.restrict('a', { blocked: false, cold: false });
      let now = 0;
      const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
      const packets: { at: number; input: MovementInput }[] = [];
      const client = new MovementClient(
        'jezero',
        () => 'a',
        (input) => packets.push({ at: now + latency / 2, input }),
      );
      const snapshots: { at: number; value: ReturnType<RoomMovement['snapshot']> }[] = [];
      client.accept(room.snapshot(0, 1));
      for (let frame = 1; frame <= 180; frame++) {
        now = (frame * 1000) / 30;
        const direction =
          frame < 90 ? mapDirection((Math.floor(frame / 30) * Math.PI) / 2, 1, 0) : null;
        client.advance(MOVEMENT_DT, { ...neutralInput(), direction }, true, 1);
        for (const packet of packets.filter((p) => p.at <= now)) room.input('a', packet.input, now);
        for (let i = packets.length - 1; i >= 0; i--)
          if (packets[i]!.at <= now) packets.splice(i, 1);
        room.step(now, 1, false);
        if (frame % 3 === 0 && frame % 9 !== 0)
          snapshots.push({ at: now + latency / 2, value: room.snapshot(now, 1) });
        for (const snapshot of snapshots.filter((s) => s.at <= now)) client.accept(snapshot.value);
        for (let i = snapshots.length - 1; i >= 0; i--)
          if (snapshots[i]!.at <= now) snapshots.splice(i, 1);
      }
      const authoritative = room.players.get('a')!.state;
      expect(
        Math.hypot(client.state!.x - authoritative.x, client.state!.z - authoritative.z),
      ).toBeLessThan(0.05);
      const latest = client.snapshot!;
      client.accept({ ...latest, tick: latest.tick - 1, players: [] });
      expect(client.snapshot).toBe(latest);
      clock.mockRestore();
    },
  );
  it('não envia movimento desconectado e aplica teleporte sem interpolar pelo habitat', () => {
    const room = new RoomMovement('jezero');
    room.join('a', 0);
    room.action('a', 'ready');
    room.restrict('a', { blocked: false, cold: false });
    const send = vi.fn();
    const client = new MovementClient('jezero', () => 'a', send);
    client.accept(room.snapshot(0, 1));
    const before = client.state!.x;
    client.advance(1, { ...neutralInput(), direction: { x: 1, z: 0 } }, false, 1);
    expect(send).not.toHaveBeenCalled();
    expect(client.state!.x).toBe(before);
    room.action('a', 'infirmary');
    client.accept(room.snapshot(100, 1));
    expect(client.state!.x).toBe(room.players.get('a')!.state.x);
    expect(client.state!.z).toBe(room.players.get('a')!.state.z);
  });
});
