import { describe, expect, it } from 'vitest';
import { HUD_LESSONS, HUD_TOUR_SKIPPED, nextHudLesson, spotlightTarget } from './hudTour';

describe('HUD teaching', () => {
  it('starts with suit oxygen, then day cycle, without confusing it with the air filter', () => {
    const memory = { introduced: ['hudOxygen'], mastered: [] as string[] };
    expect(nextHudLesson(memory)?.id).toBe('hudOxygen');
    memory.mastered.push('hudOxygen');
    expect(nextHudLesson(memory)?.id).toBe('hudCycle');
    expect(spotlightTarget('oxygen')).toBeUndefined();
    expect(spotlightTarget('low')).toBe('personal-oxygen');
  });
  it('skips unavailable widgets and ends after acknowledged topics', () => {
    expect(
      nextHudLesson({ introduced: [], mastered: [] }, (target) => target === 'speed')?.id,
    ).toBe('hudSpeed');
    expect(
      nextHudLesson({ introduced: [], mastered: HUD_LESSONS.map((x) => x.id) }),
    ).toBeUndefined();
    expect(nextHudLesson({ introduced: [], mastered: [HUD_TOUR_SKIPPED] })).toBeUndefined();
  });
  it('does not teach retired or concurrently developed mechanics', () => {
    expect(HUD_LESSONS.some((x) => /armor|material|shield/i.test(x.target))).toBe(false);
    expect(HUD_LESSONS.some((x) => x.target.startsWith('hud-'))).toBe(false);
    expect(new Set(HUD_LESSONS.map((x) => x.target)).size).toBe(HUD_LESSONS.length);
  });
});
