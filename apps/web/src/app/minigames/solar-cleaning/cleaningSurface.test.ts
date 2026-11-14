import { describe, expect, it } from 'vitest';
import { CleaningSurface } from './cleaningSurface';

const allDust = () => new CleaningSurface(100, 100, 100, 100, new Uint8Array(10000).fill(1));

describe('solar panel cleaning', () => {
  it('counts actual dust once, regardless of repeated or reversed strokes', () => {
    const surface = allDust();
    const initial = surface.remainingDust;
    const a = { x: 10, y: 50 };
    const b = { x: 90, y: 50 };
    const removed = surface.sweep(a, b, 8);
    expect(removed).toBeGreaterThan(1200);
    expect(surface.remainingDust).toBe(initial - removed);
    expect(surface.sweep(a, b, 8)).toBe(0);
    expect(surface.sweep(b, a, 8)).toBe(0);
    expect(surface.complete).toBe(false);
  });

  it('leaves no gaps between fast pointer samples and produces the same result as short segments', () => {
    const fast = allDust();
    const slow = allDust();
    fast.sweep({ x: 3, y: 7 }, { x: 93, y: 97 }, 6);
    for (let i = 0; i < 90; i++) {
      slow.sweep({ x: 3 + i, y: 7 + i }, { x: 4 + i, y: 8 + i }, 6);
    }
    expect(fast.remainingDust).toBe(slow.remainingDust);
  });

  it('cleans a tap, clips to panel boundaries and ignores strokes outside the surface', () => {
    const surface = allDust();
    expect(surface.sweep({ x: -30, y: 10 }, { x: -20, y: 90 }, 8)).toBe(0);
    expect(surface.sweep({ x: 50, y: 50 }, { x: 50, y: 50 }, 8)).toBeGreaterThan(180);
    const beforeEdge = surface.remainingDust;
    const edge = surface.sweep({ x: 0, y: 0 }, { x: 0, y: 0 }, 8);
    expect(edge).toBeGreaterThan(40);
    expect(edge).toBeLessThan(60);
    expect(surface.remainingDust).toBe(beforeEdge - edge);
    expect(surface.sweep({ x: Number.NaN, y: 0 }, { x: 50, y: 50 }, 8)).toBe(0);
  });

  it('excludes initially clean cells and completes from area rather than number of strokes', () => {
    const coverage = new Uint8Array(10000);
    coverage.fill(1, 8000);
    const surface = new CleaningSurface(100, 100, 100, 100, coverage);
    expect(surface.initialDust).toBe(2000);
    expect(surface.sweep({ x: 0, y: 20 }, { x: 100, y: 20 }, 10)).toBe(0);
    expect(surface.complete).toBe(false);
    surface.sweep({ x: -20, y: 90 }, { x: 120, y: 90 }, 11);
    expect(surface.remainingDust).toBe(0);
    expect(surface.complete).toBe(true);
    // The caller's original data stays reusable for another round.
    expect(new CleaningSurface(100, 100, 100, 100, coverage).initialDust).toBe(2000);
  });

  it('allows a tiny residual so completion never requires hunting individual specks', () => {
    const coverage = new Uint8Array(10000).fill(1);
    const surface = new CleaningSurface(100, 100, 100, 100, coverage);
    for (let y = 1; y < 100; y += 2) surface.sweep({ x: 0, y }, { x: 98.5, y }, 1.1);
    expect(surface.remainingDust).toBeGreaterThan(0);
    expect(surface.remainingDust).toBeLessThanOrEqual(150);
    expect(surface.complete).toBe(true);
  });
});
