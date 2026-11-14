import { describe, expect, it } from 'vitest';
import { GAME_SOL_SECONDS, GAME_START_HOUR, gameClock } from './game';

const HOUR_MS = (GAME_SOL_SECONDS * 1000) / 24;
const START = 1_000_000;

describe('gameClock', () => {
  it('sem opções: tempo real desde o início da sala', () => {
    const c = gameClock(START, START + 2 * HOUR_MS);
    expect(c.hour).toBeCloseTo(GAME_START_HOUR + 2);
    expect(c.sol).toBe(1);
    expect(c.elapsedMs).toBe(2 * HOUR_MS);
  });

  it('escala 1 sem âncora equivale ao relógio sem opções (não conta em dobro)', () => {
    const now = START + 3 * HOUR_MS;
    expect(gameClock(START, now, { scale: 1 })).toEqual(gameClock(START, now));
  });

  it('acelera só a partir da âncora, somando o tempo virtual acumulado', () => {
    const c = gameClock(START, START + 3 * HOUR_MS, {
      scale: 3,
      timeUpdatedAt: START + 2 * HOUR_MS,
      virtualElapsedMs: 2 * HOUR_MS,
    });
    expect(c.elapsedMs).toBe(2 * HOUR_MS + 3 * HOUR_MS);
  });

  it('pausado congela no tempo virtual acumulado', () => {
    const opts = { paused: true, timeUpdatedAt: START + HOUR_MS, virtualElapsedMs: 5 * HOUR_MS };
    expect(gameClock(START, START + 10 * HOUR_MS, opts).elapsedMs).toBe(5 * HOUR_MS);
    expect(gameClock(START, START + 99 * HOUR_MS, opts).elapsedMs).toBe(5 * HOUR_MS);
  });

  it('nunca retrocede antes do início nem da âncora', () => {
    expect(gameClock(START, START - HOUR_MS).elapsedMs).toBe(0);
    expect(
      gameClock(START, START, { scale: 2, timeUpdatedAt: START + HOUR_MS, virtualElapsedMs: 0 })
        .elapsedMs,
    ).toBe(0);
  });
});
