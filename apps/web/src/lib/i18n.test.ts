// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { EN } from './i18n.en';
import { deviceLang } from './i18n';

describe('idiomas', () => {
  it('o padrão do jogo é inglês e o português fica nas configurações', async () => {
    localStorage.removeItem('mo_lang');
    Object.defineProperty(navigator, 'languages', { value: ['en-US'], configurable: true });
    vi.resetModules();
    const mod = await import('./i18n');
    expect(mod.getLang()).toBe('en');
    expect(mod.L('Olá', 'Hello')).toBe('Hello');
    expect(mod.t('Cápsula de carga da Terra')).toBe('Cargo capsule from Earth');
  });

  it('português e espanhol do aparelho começam em PT-BR; o resto em inglês', () => {
    expect(deviceLang(['pt-BR', 'en'])).toBe('pt');
    expect(deviceLang(['es-MX'])).toBe('pt');
    expect(deviceLang(['en-US', 'pt'])).toBe('en');
    expect(deviceLang(['fr'])).toBe('en');
    expect(deviceLang(undefined)).toBe('en');
  });

  it('o dicionário em inglês não tem entradas vazias', () => {
    for (const [pt, en] of Object.entries(EN)) {
      expect(en.trim().length, pt).toBeGreaterThan(0);
    }
  });
});
