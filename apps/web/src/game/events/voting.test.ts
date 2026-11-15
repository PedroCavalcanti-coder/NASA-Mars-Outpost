import { describe, expect, it } from 'vitest';
import { scaleDamage } from './shielding';
import { modeFor, pickDecider, tally } from './voting';

describe('decisão dos eventos', () => {
  it('1 jogador decide direto, 2 sorteiam um, 3 e 4 votam', () => {
    expect(modeFor(1)).toBe('solo');
    expect(modeFor(2)).toBe('decider');
    expect(modeFor(3)).toBe('vote');
    expect(modeFor(4)).toBe('vote');
  });

  it('o sorteado é o mesmo para todos, em qualquer ordem da lista', () => {
    const a = pickDecider(['b', 'a'], 5, 4);
    expect(a).toBe(pickDecider(['a', 'b'], 5, 4));
    expect(['a', 'b']).toContain(a);
  });

  it('vence a opção mais votada; sem votos, a primeira', () => {
    expect(tally({ x: 1, y: 1, z: 0 }, 3, 1, 4)).toBe(1);
    expect(tally({}, 3, 1, 4)).toBe(0);
  });

  it('empate resolve de forma determinística entre as empatadas', () => {
    const r = tally({ x: 0, y: 2 }, 3, 9, 5);
    expect([0, 2]).toContain(r);
    expect(tally({ x: 0, y: 2 }, 3, 9, 5)).toBe(r);
  });
});

describe('blindagem', () => {
  it('com blindagem acima de zero as perdas ficam como estão', () => {
    expect(scaleDamage({ energy: -10, research: 5 }, 30)).toEqual({ energy: -10, research: 5 });
  });

  it('com blindagem zerada, perdas de energia, mantimentos e oxigênio dobram', () => {
    expect(
      scaleDamage({ energy: -10, supplies: -4, oxygen: -6, materials: -8, research: 5, shielding: -5 }, 0),
    ).toEqual({ energy: -20, supplies: -8, oxygen: -12, materials: -8, research: 5, shielding: -5 });
  });
});
