import { describe, expect, it } from 'vitest';
import { CROPS, cropReducer, healthy, initialCrops, plantHealth } from './greenhouseState';

describe('greenhouse care', () => {
  it('a planta se recupera quando recebe água suficiente (a luz não é mais exigida)', () => {
    let crops = initialCrops();
    expect(crops.some(healthy)).toBe(false);
    crops = cropReducer(crops, { type: 'water', index: 0, seconds: 10 });
    expect(healthy(crops[0], 0)).toBe(true);
    expect(healthy(crops[1], 1)).toBe(false);
  });
  it('preserves partial watering, prevents overflow, and leaves other beds alone', () => {
    const initial = initialCrops();
    const partial = cropReducer(initial, { type: 'water', index: 1, seconds: 0.5 });
    expect(partial[1].water).toBeGreaterThan(initial[1].water);
    expect(partial[1].water).toBeLessThan(CROPS[1].water);
    expect(partial[0]).toBe(initial[0]);
    expect(initial[1].water).toBe(0.08);
    const saturated = cropReducer(partial, { type: 'water', index: 1, seconds: 1000 });
    expect(saturated[1].water).toBe(CROPS[1].water);
    for (const seconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(cropReducer(partial, { type: 'water', index: 1, seconds })).toEqual(partial);
    }
  });
  it('finishes only when all three beds recover, freezes the result and resets the round', () => {
    let crops = initialCrops();
    for (const index of [2, 0, 1] as const) {
      crops = cropReducer(crops, { type: 'light', index });
      crops = cropReducer(crops, { type: 'water', index, seconds: 10 });
      if (index !== 1) expect(crops.every(healthy)).toBe(false);
    }
    expect(crops.every(healthy)).toBe(true);
    expect(cropReducer(crops, { type: 'light', index: 0 })).toBe(crops);
    const reset = cropReducer(crops, { type: 'reset' });
    expect(reset).toEqual(initialCrops());
    expect(reset.every(healthy)).toBe(false);
  });
});
