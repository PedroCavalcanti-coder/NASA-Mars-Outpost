import { assignOuter, newIntegrity, REPAIR_KINDS, repairIntent, type GameplayMovement, type GameplayState } from '@mars/shared';
import { describe, expect, it } from 'vitest';
import { eventsForSol, majorChance, WEATHER_EVENT_IDS } from './eventRules';
import {
  addGameplayPlayer,
  applyGameplayCommand,
  applyGameplayRepair,
  createGameplay,
  RADIATION_OUTSIDE_RATE,
  startRadiation,
  stepGameplay,
} from './world';

function makeMovement(inside: boolean) {
  const locks: boolean[] = [];
  const m: GameplayMovement = {
    context: () => ({ x: 0, z: 0, inside, sheltered: false, driving: false, ready: true }),
    near: () => true,
    restrict: () => {},
    rescue: () => {},
    lockExit: (on) => locks.push(on),
  };
  return { m, locks };
}

function room(inside: boolean) {
  const { m, locks } = makeMovement(inside);
  let s: GameplayState = createGameplay(7, 'g', [0], [1]);
  addGameplayPlayer(s, 'a', 'A');
  s = applyGameplayCommand(s, 'a', { type: 'ready' }, m, 'jezero', true).state;
  return { s, m, locks };
}

describe('radiação alta', () => {
  it('trava a saída da base enquanto dura e libera depois', () => {
    const { s, m, locks } = room(true);
    startRadiation(s, 'Tempestade', 3);
    expect(s.radiation).toBeTruthy();
    stepGameplay(s, 100, m, 'jezero');
    expect(locks.at(-1)).toBe(true);
    s.elapsedMs = s.radiation!.until + 1;
    stepGameplay(s, 100, m, 'jezero');
    expect(s.radiation).toBeNull();
    expect(locks.at(-1)).toBe(false);
    expect(s.mission.log.some((e) => e.title.includes('Radiação segura'))).toBe(true);
  });

  it('quem está fora recebe dose rápido; quem está dentro, só a de fundo', () => {
    const out = room(false);
    const inn = room(true);
    for (const r of [out, inn]) {
      startRadiation(r.s, 'Tempestade', 3);
      const before = r.s.dose ?? 0;
      for (let i = 0; i < 100; i++) stepGameplay(r.s, 100, r.m, 'jezero');
      r.s.dose = (r.s.dose ?? 0) - before;
    }
    expect(out.s.dose!).toBeGreaterThan(inn.s.dose! + RADIATION_OUTSIDE_RATE.foot * 5);
  });

  it('a duração fica entre 2 e 8 horas de Marte', () => {
    const { s } = room(true);
    startRadiation(s, 'a', 0.1);
    const short = s.radiation!.until - s.elapsedMs;
    startRadiation(room(true).s, 'b', 99);
    expect(short).toBeGreaterThan(0);
    const long = room(true).s;
    startRadiation(long, 'b', 99);
    expect((long.radiation!.until - long.elapsedMs) / (600000 / 24)).toBeCloseTo(8, 5);
  });
});

describe('reparo do lado de fora', () => {
  function withFracture(inside: boolean) {
    const r = room(inside);
    r.s.integrity = newIntegrity(3);
    assignOuter(r.s.integrity, [1, 2]);
    repairIntent(r.s.integrity, { op: 'damage', amount: 10 }, 'x', 0, 0);
    return { ...r, fracture: r.s.integrity.fractures[0]! };
  }

  it('dentro da base o servidor não deixa reservar a rachadura', () => {
    const { s, m, fracture } = withFracture(true);
    expect(applyGameplayRepair(s, 'a', { op: 'reserve', fracture: fracture.id }, m, false)).toBe(false);
  });

  it('do lado de fora, de dia e sem radiação, reserva; com radiação alta, não', () => {
    const { s, m, fracture } = withFracture(false);
    s.elapsedMs = 1000; // 9h: dia
    expect(applyGameplayRepair(s, 'a', { op: 'reserve', fracture: fracture.id }, m, false)).toBe(true);
    applyGameplayRepair(s, 'a', { op: 'release', fracture: fracture.id }, m, false);
    startRadiation(s, 'Tempestade', 3);
    expect(applyGameplayRepair(s, 'a', { op: 'reserve', fracture: fracture.id }, m, false)).toBe(false);
  });

  it('rachaduras só nascem em paredes externas e variam de tipo', () => {
    const s = newIntegrity(11);
    assignOuter(s, [2, 4, 5]);
    for (let i = 0; i < 3; i++) repairIntent(s, { op: 'damage', amount: 10 }, 'x', 0, 0);
    expect(s.fractures.every((f) => [2, 4, 5].includes(f.anchor))).toBe(true);
    expect(new Set(s.fractures.map((f) => f.kind)).size).toBe(3);
    expect(REPAIR_KINDS).toHaveLength(5);
  });

  it('rachadura salva numa parede interna é levada para uma externa', () => {
    const s = newIntegrity(5);
    s.fractures.push({ id: 1, anchor: 0, damage: 10, nextDecay: 100, tutorial: false, plate: false, screws: [] });
    assignOuter(s, [3, 4]);
    expect(s.fractures[0]!.anchor).toBe(3);
    expect(s.fractures[0]!.kind).toBe(1);
  });
});

describe('mais jogadores, mais clima', () => {
  it('a chance de evento grande sobe com a tripulação e 4 jogadores têm mais eventos de clima', () => {
    expect(majorChance(4)).toBeGreaterThan(majorChance(1));
    const weather = (players: number) => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++)
        for (let sol = 4; sol < 14; sol++)
          n += eventsForSol(seed * 977, sol, players).filter((e) => WEATHER_EVENT_IDS.includes(e.id)).length;
      return n;
    };
    expect(weather(4)).toBeGreaterThan(weather(1) * 1.4);
  });

  it('sozinho nada muda (compatível com o sorteio antigo)', () => {
    expect(eventsForSol(5, 6).map((e) => e.id)).toEqual(eventsForSol(5, 6, 1).map((e) => e.id));
  });
});
