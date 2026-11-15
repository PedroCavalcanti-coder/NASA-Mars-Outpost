// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { EN } from './i18n.en';

describe('idiomas', () => {
  it('o padrão do jogo é inglês e o português fica nas configurações', async () => {
    localStorage.removeItem('mo_lang');
    vi.resetModules();
    const mod = await import('./i18n');
    expect(mod.getLang()).toBe('en');
    expect(mod.L('Olá', 'Hello')).toBe('Hello');
    expect(mod.t('Cápsula de carga da Terra')).toBe('Cargo capsule from Earth');
  });

  it('o dicionário em inglês não tem entradas vazias', () => {
    for (const [pt, en] of Object.entries(EN)) {
      expect(en.trim().length, pt).toBeGreaterThan(0);
    }
  });
});
