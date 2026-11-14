import { describe, expect, it } from 'vitest';
import {
  applyTimeChange,
  GAME_SOL_SECONDS,
  GAME_START_HOUR,
  GAME_TIME_MAX_ADVANCE_MS,
  type GameWorldState,
  gameClock,
  worldClock,
} from './game';

const newWorld = (clockStart: number): GameWorldState => ({
  clockStart,
  storm: 0,
  solar: [],
  crops: [],
});

describe('applyTimeChange / worldClock', () => {
  const START = 5_000_000;
  const HOUR = (GAME_SOL_SECONDS * 1000) / 24;

  it('trocar a velocidade não faz a hora pular', () => {
    const w = newWorld(START);
    const now = START + 2 * HOUR;
    const before = worldClock(w, now).hour;
    applyTimeChange(w, now, { paused: false, scale: 3 });
    expect(worldClock(w, now).hour).toBeCloseTo(before);
    // 1 hora real depois, a 3×, andou 3 horas de jogo
    expect(worldClock(w, now + HOUR).hour).toBeCloseTo(before + 3);
  });

  it('pausar congela e retomar continua de onde parou', () => {
    const w = newWorld(START);
    applyTimeChange(w, START + HOUR, { paused: true, scale: 1 });
    expect(worldClock(w, START + 10 * HOUR).elapsedMs).toBe(HOUR);
    applyTimeChange(w, START + 10 * HOUR, { paused: false, scale: 1 });
    expect(worldClock(w, START + 11 * HOUR).elapsedMs).toBe(2 * HOUR);
  });

  it('salto de tempo é limitado a 1 Sol e ignora valores inválidos', () => {
    const w = newWorld(START);
    applyTimeChange(w, START, { paused: false, scale: 1, advanceMs: 1e12 });
    expect(worldClock(w, START).elapsedMs).toBe(GAME_TIME_MAX_ADVANCE_MS);
    applyTimeChange(w, START, { paused: false, scale: 1, advanceMs: Number.NaN });
    expect(worldClock(w, START).elapsedMs).toBe(GAME_TIME_MAX_ADVANCE_MS);
    applyTimeChange(w, START, { paused: false, scale: 1, advanceMs: -5 });
    expect(worldClock(w, START).elapsedMs).toBe(GAME_TIME_MAX_ADVANCE_MS);
  });

  it('escala inválida vira 1×', () => {
    const w = newWorld(START);
    const t = applyTimeChange(w, START, { paused: false, scale: 7 as never });
    expect(t.scale).toBe(1);
  });
});

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
