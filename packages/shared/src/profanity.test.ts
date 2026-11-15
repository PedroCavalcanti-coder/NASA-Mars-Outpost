import { describe, expect, it } from 'vitest';
import { hasProfanity, maskProfanity } from './profanity';

describe('filtro de palavrões', () => {
  it('pega palavrões com variações (acento, número, letra repetida)', () => {
    for (const t of ['PORRA', 'p0rr@', 'fooooda', 'vai se f0der', 'fuck you', 'sh1t', 'filho da puta', 'c u z a o'.replace(/ /g, '')])
      expect(hasProfanity(t), t).toBe(true);
  });
  it('não bloqueia palavras normais do jogo (sem falso positivo)', () => {
    for (const t of ['computador', 'cuidado com a radiação', 'consertar o painel', 'passei na análise', 'oxigênio acabando', 'Marte é legal', 'classe X9.0', 'assistir', 'massa', 'bom dia astronauta', 'pausa', 'puta', 'rapel'].filter((x) => x !== 'puta'))
      expect(hasProfanity(t), t).toBe(false);
  });
  it('mascara só a palavra ofensiva', () => {
    expect(maskProfanity('que merda de tempestade')).toBe('que ***** de tempestade');
  });
});
