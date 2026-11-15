import { describe, expect, it } from 'vitest';
import { inZone, pingPong, soilQuality, stationQuality, zoneFor } from './scoring';

describe('barra de calibração', () => {
  it('o cursor vai e volta entre 0 e 1', () => {
    expect(pingPong(0, 1)).toBe(0);
    expect(pingPong(1, 1)).toBe(1);
    expect(pingPong(1.5, 1)).toBeCloseTo(0.5);
    expect(pingPong(2, 1)).toBeCloseTo(0);
  });

  it('a zona verde encolhe mas nunca some', () => {
    expect(zoneFor(0, 0.5).half).toBeGreaterThan(zoneFor(4, 0.5).half);
    expect(zoneFor(50, 0.5).half).toBe(0.1);
    const z = zoneFor(0, 0);
    expect(z.center).toBeCloseTo(0.2);
    expect(inZone(0.2, z)).toBe(true);
    expect(inZone(0.9, z)).toBe(false);
  });

  it('nota pelos acertos', () => {
    expect(stationQuality(3, 3)).toBe(1);
    expect(stationQuality(1, 4)).toBe(0.25);
    expect(stationQuality(0, 0)).toBe(0);
  });
});

describe('coleta de solo', () => {
  it('rápido vale tudo, lento vale menos, mas nunca zero', () => {
    expect(soilQuality([1000, 2000])).toBe(1);
    expect(soilQuality([9000, 9000])).toBeCloseTo(0.35);
    const mid = soilQuality([4750]);
    expect(mid).toBeGreaterThan(0.35);
    expect(mid).toBeLessThan(1);
    expect(soilQuality([])).toBe(0);
  });
});
