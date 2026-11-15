import { describe, expect, it } from 'vitest';
import { EVENT_FIRST_SOL, eventsForSol, GAME_EVENTS, resolveChoice } from './events';

describe('eventos da base', () => {
  it('nenhum evento acontece nos 3 primeiros sóis', () => {
    for (const seed of [1, 7, 12345, 99999]) {
      for (let sol = 1; sol < EVENT_FIRST_SOL; sol++) {
        expect(eventsForSol(seed, sol)).toEqual([]);
      }
    }
  });

  it('a partir do sol 4 há um evento fácil por dia, igual para a sala toda', () => {
    for (let sol = EVENT_FIRST_SOL; sol < EVENT_FIRST_SOL + 30; sol++) {
      const a = eventsForSol(42, sol);
      const b = eventsForSol(42, sol);
      expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
      expect(a.some((e) => e.kind === 'easy')).toBe(true);
    }
  });

  it('eventos grandes aparecem de vez em quando', () => {
    let majors = 0;
    for (let sol = 4; sol < 104; sol++) {
      if (eventsForSol(7, sol).some((e) => e.kind === 'major')) majors++;
    }
    expect(majors).toBeGreaterThan(10);
    expect(majors).toBeLessThan(90);
  });

  it('todo evento tem ao menos 2 opções e cada uma resulta em algo', () => {
    for (const e of GAME_EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of e.choices) {
        const hasEffect = (o: typeof c.outcome) =>
          Object.values(o.deltas ?? {}).some(Boolean) || (o.effects?.length ?? 0) > 0 || !!o.text;
        expect(hasEffect(c.outcome)).toBe(true);
        if (c.risk) expect(hasEffect(c.risk.outcome)).toBe(true);
      }
    }
  });

  it('o risco usa o resultado alternativo só abaixo da chance', () => {
    const risky = GAME_EVENTS.flatMap((e) => e.choices).find((c) => c.risk);
    expect(risky).toBeDefined();
    if (!risky?.risk) return;
    expect(resolveChoice(risky, risky.risk.chance - 0.001)).toBe(risky.risk.outcome);
    expect(resolveChoice(risky, 0.999)).toBe(risky.outcome);
  });
});
