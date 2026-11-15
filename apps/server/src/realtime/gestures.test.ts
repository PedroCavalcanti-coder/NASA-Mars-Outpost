import type { GameMotion } from '@mars/shared';
import { describe, expect, it } from 'vitest';
import { GestureBroker } from './gestures';

const at = (x: number, z: number, m: GameMotion['m'] = 'idle'): { motion: GameMotion } => ({
  motion: { x, z, h: 0, m },
});

function room() {
  const players = new Map([
    ['a', at(0, 0)],
    ['b', at(1.5, 0)],
    ['far', at(10, 0)],
    ['car', at(0.5, 0, 'drive')],
  ]);
  return (id: string) => players.get(id);
}

describe('GestureBroker', () => {
  it('convite válido e aceite iniciam o gesto para os dois', () => {
    const broker = new GestureBroker();
    const lookup = room();
    const inv = broker.invite('a', 'b', 'handshake', lookup, 1000);
    expect(inv).toEqual({ ok: true, targetId: 'b', gesture: 'handshake' });
    const acc = broker.accept('b', 'a', lookup, 2000);
    expect(acc).toEqual({
      ok: true,
      start: { a: 'a', b: 'b', gesture: 'handshake', at: 2000 },
    });
    // convite é de uso único
    expect(broker.accept('b', 'a', lookup, 2100).ok).toBe(false);
  });

  it('rejeita gesto fora da lista, texto livre e ids fora da sala', () => {
    const broker = new GestureBroker();
    const lookup = room();
    expect(broker.invite('a', 'b', 'chute', lookup, 0).ok).toBe(false);
    expect(broker.invite('a', 'b', { x: 1 }, lookup, 0).ok).toBe(false);
    expect(broker.invite('a', 'ninguem', 'hug', lookup, 0).ok).toBe(false);
    expect(broker.invite('a', 42, 'hug', lookup, 0).ok).toBe(false);
    expect(broker.invite('a', 'a', 'hug', lookup, 0).ok).toBe(false);
    expect(broker.accept('b', 'fantasma', lookup, 0).ok).toBe(false);
  });

  it('exige no máximo 2,5 m e os dois fora do rover', () => {
    const broker = new GestureBroker();
    const lookup = room();
    expect(broker.invite('a', 'far', 'hug', lookup, 0).ok).toBe(false);
    expect(broker.invite('a', 'car', 'hug', lookup, 0).ok).toBe(false);
  });

  it('limita a ~1 convite a cada 3 s por jogador', () => {
    const broker = new GestureBroker();
    const lookup = room();
    expect(broker.invite('a', 'b', 'hug', lookup, 10_000).ok).toBe(true);
    expect(broker.invite('a', 'b', 'hug', lookup, 11_000).ok).toBe(false);
    expect(broker.invite('a', 'b', 'hug', lookup, 13_100).ok).toBe(true);
  });

  it('o convite expira em ~5 s e é revalidado no aceite', () => {
    const broker = new GestureBroker();
    const lookup = room();
    broker.invite('a', 'b', 'fist_bump', lookup, 0);
    expect(broker.accept('b', 'a', lookup, 5001).ok).toBe(false);
    broker.invite('a', 'b', 'fist_bump', lookup, 20_000);
    broker.remove('a');
    expect(broker.accept('b', 'a', lookup, 20_500).ok).toBe(false);
  });
});
