import { normalizeNickname, WORLD_MISSION_MAX_BYTES } from '@mars/shared';
import { describe, expect, it } from 'vitest';
import { parseCookies, sanitizeSave } from './service';

describe('apelido', () => {
  it('compara sem acento, caixa e espaços repetidos', () => {
    expect(normalizeNickname('  Ana  Lúcia ')).toBe('ana lucia');
    expect(normalizeNickname('ANA LUCIA')).toBe(normalizeNickname('ana  lúcia'));
  });
});

describe('sanitizeSave', () => {
  const base = { elapsedMs: 1000, solar: [0, 9, -3], crops: [1, 7] };

  it('limita estágios e tamanhos', () => {
    const s = sanitizeSave({ ...base, solar: new Array(80).fill(9), crops: [7, -1] });
    expect(s?.solar.length).toBeLessThanOrEqual(32);
    expect(Math.max(...(s?.solar ?? []))).toBe(4);
    expect(s?.crops).toEqual([3, 0]);
  });

  it('recusa missão grande demais', () => {
    const big = { text: 'x'.repeat(WORLD_MISSION_MAX_BYTES + 10) };
    expect(sanitizeSave({ ...base, mission: big })).toBeNull();
    expect(sanitizeSave({ ...base, mission: { sol: 2 } })?.mission).toEqual({ sol: 2 });
  });

  it('guarda velocidade e pausa só quando válidas', () => {
    const s = sanitizeSave({ ...base, timeScale: 3, paused: true });
    expect(s?.timeScale).toBe(3);
    expect(s?.paused).toBe(true);
    const bad = sanitizeSave({ ...base, timeScale: 99, paused: 'sim' });
    expect(bad?.timeScale).toBeUndefined();
    expect(bad?.paused).toBeUndefined();
  });
});

describe('cookies', () => {
  it('lê pares do cabeçalho', () => {
    expect(parseCookies('a=1; mo_pk=abc%20d; x')).toEqual({ a: '1', mo_pk: 'abc d' });
    expect(parseCookies(undefined)).toEqual({});
  });
});
