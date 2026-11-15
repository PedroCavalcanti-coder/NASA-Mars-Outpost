import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LINES } from './catalog';
import { GuideEngine, readMemory } from './engine';
import { emitGuideEvent, subscribeGuide } from './events';

describe('B.I.T. individual learning', () => {
  it('waits for acknowledgement and spaces automatic messages', () => {
    const guide = new GuideEngine();
    guide.offer('welcome', 0);
    guide.offer('move', 1);
    guide.tick(20000);
    expect(guide.current?.id).toBe('welcome');
    guide.dismiss();
    guide.tick(20001);
    expect(guide.current?.id).toBe('move');
    guide.dismiss();
    guide.offer('solar', 21000);
    expect(guide.current).toBeNull();
    guide.tick(32001);
    expect(guide.current?.id).toBe('solar');
  });
  it('does not repeat learned content but accepts explicit help', () => {
    const guide = new GuideEngine({ introduced: ['solar'], mastered: ['solar'] });
    guide.offer('solar', 0);
    expect(guide.current).toBeNull();
    guide.offer('solarHint', 1, true, true);
    expect(guide.current?.id).toBe('solarHint');
  });
  it('a real risk replaces stale messages; a resolved risk can be discarded', () => {
    const guide = new GuideEngine();
    guide.offer('welcome', 0);
    guide.offer('move', 0);
    guide.offer('low', 1, true);
    expect(guide.current?.id).toBe('low');
    guide.discard('low');
    guide.tick(20000);
    expect(guide.current).toBeNull();
  });
  it('clearing a cancelled activity never masters it', () => {
    const guide = new GuideEngine();
    guide.offer('oxygen', 0);
    guide.clear();
    expect(guide.memory.mastered).toEqual([]);
    guide.master('oxygen');
    guide.master('oxygen');
    expect(guide.memory.mastered).toEqual(['oxygen']);
  });
  it('handles blocked storage and validates saved progress', () => {
    expect(
      readMemory(
        {
          getItem: () => {
            throw Error();
          },
        },
        'key',
      ).introduced,
    ).toEqual([]);
    expect(readMemory({ getItem: () => '{' }, 'key').mastered).toEqual([]);
    expect(
      readMemory(
        {
          getItem: () =>
            JSON.stringify({ introduced: ['welcome', 'obsolete', 7], mastered: ['solar', null] }),
        },
        'key',
      ),
    ).toEqual({ introduced: ['welcome'], mastered: ['solar'] });
  });
  it('unsubscribes safely through mount/unmount cycles', () => {
    let count = 0;
    const stop = subscribeGuide(() => count++);
    emitGuideEvent({ type: 'ready' });
    stop();
    stop();
    emitGuideEvent({ type: 'complete', activity: 'solar' });
    expect(count).toBe(1);
  });
  it('ships an offline voice clip for every line and excludes retired mechanics', () => {
    for (const [id, line] of Object.entries(LINES)) {
      expect(existsSync(resolve('apps/web/public/assets/audio/bit/en', `${id}.mp3`)), id).toBe(
        true,
      );
      expect(line.text).not.toMatch(/materials|armor|shielding|blindagem/i);
    }
  });
});
