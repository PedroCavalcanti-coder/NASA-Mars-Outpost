import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LORE } from './lore';

describe('curiosidades da base', () => {
  it('toda curiosidade tem foto existente, crédito, fonte https e texto', () => {
    for (const l of Object.values(LORE)) {
      expect(existsSync(`apps/web/public${l.image}`) || existsSync(`public${l.image}`)).toBe(true);
      expect(l.credit.length).toBeGreaterThan(5);
      expect(l.body.length).toBeGreaterThan(40);
      expect(l.links.length).toBeGreaterThan(0);
      for (const k of l.links) expect(k.url.startsWith('https://')).toBe(true);
    }
  });

  it('a horta cita o material da Agência Espacial Canadense', () => {
    expect(LORE.garden.links.some((k) => k.url.includes('asc-csa.gc.ca'))).toBe(true);
  });
});
