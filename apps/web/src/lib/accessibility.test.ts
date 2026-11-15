// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { applyA11y, daltonize } from './accessibility';

describe('acessibilidade', () => {
  it('a matriz de daltonização tem 20 valores e preserva o branco', () => {
    for (const m of ['protan', 'deutan', 'tritan'] as const) {
      const v = daltonize(m);
      expect(v).toHaveLength(20);
      // linha do vermelho aplicada ao branco (1,1,1) continua perto de 1 no canal que sobra
      expect(v[0]! + v[1]! + v[2]!).toBeGreaterThan(0.9);
    }
  });
  it('liga e desliga os atributos no html', () => {
    applyA11y({ colorMode: 'deutan', contrast: true, calm: true, bigTargets: false, readable: false, narrate: false, narrateSlow: false });
    const root = document.documentElement;
    expect(root.getAttribute('data-cb')).toBe('deutan');
    expect(root.hasAttribute('data-contrast')).toBe(true);
    expect(root.hasAttribute('data-calm')).toBe(true);
    expect(document.getElementById('mo-a11y-filters')).not.toBeNull();
    applyA11y({ colorMode: 'none', contrast: false, calm: false, bigTargets: false, readable: false, narrate: false, narrateSlow: false });
    expect(root.hasAttribute('data-cb')).toBe(false);
  });
});
