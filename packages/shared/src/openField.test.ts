import { describe, expect, it } from 'vitest';
import { navigationFor, openFieldFor } from './movement';

describe('campo aberto da expedição', () => {
  it('não tem estruturas: onde a base bloqueia, o campo é livre', () => {
    const base = navigationFor('jezero');
    const field = openFieldFor('jezero');
    let freed = 0;
    for (let x = -60; x <= 60; x += 1)
      for (let z = -60; z <= 60; z += 1) {
        expect(field.isWalkable(x, z, 'vehicle')).toBe(true);
        if (!base.isWalkable(x, z, 'vehicle')) freed++;
      }
    expect(freed).toBeGreaterThan(500); // a base tinha muitos pontos bloqueados
    expect(field.isInsideBase(0, 0)).toBe(false);
  });
  it('a borda do mundo continua bloqueando', () => {
    expect(openFieldFor('gale').isWalkable(200, 0)).toBe(false);
    expect(openFieldFor('gale').isWalkable(77.9, 0, 'vehicle')).toBe(false);
  });
});
