import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrushAudio } from './BrushAudio';

function fixture() {
  const sources: {
    buffer: unknown;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    decodeAudioData: vi.fn(async () => ({ duration: 0.25 })),
    createBufferSource: () => {
      const source = {
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      sources.push(source);
      return source;
    },
    createGain: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelAndHoldAtTime: vi.fn(),
      },
    }),
  };
  vi.stubGlobal('AudioContext', function mockAudioContext() {
    return context;
  });
  const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  vi.stubGlobal('fetch', fetch);
  return { audio: new BrushAudio(), context, sources, fetch };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('brush contact audio', () => {
  it('loads only on a gesture, never autoplays after decoding, and never repeats the previous cut', async () => {
    const { audio, context, sources, fetch } = fixture();
    audio.contact();
    expect(fetch).not.toHaveBeenCalled();
    audio.unlock();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(6));
    expect(sources).toHaveLength(0);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    for (let i = 0; i < 8; i++) {
      context.currentTime = i;
      audio.contact();
    }
    expect(sources).toHaveLength(8);
    for (let i = 1; i < sources.length; i++)
      expect(sources[i]?.buffer).not.toBe(sources[i - 1]?.buffer);
    audio.unlock();
    expect(fetch).toHaveBeenCalledTimes(6);
    audio.dispose();
  });

  it('limits voices during fast input and fades them when contact stops or the preview closes', async () => {
    const { audio, context, sources } = fixture();
    audio.unlock();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(6));
    vi.useFakeTimers();
    for (let i = 0; i < 60; i++) audio.contact();
    expect(sources).toHaveLength(1);
    vi.advanceTimersByTime(101);
    expect(sources[0]?.stop).toHaveBeenCalledTimes(1);
    context.currentTime = 1;
    audio.contact();
    audio.dispose();
    audio.dispose();
    expect(sources[1]?.stop).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    audio.contact();
    expect(sources).toHaveLength(2);
  });

  it('keeps cleaning playable when Web Audio is unavailable', () => {
    const { audio } = fixture();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('unavailable');
        }
      },
    );
    expect(() => {
      audio.unlock();
      audio.contact();
      audio.dispose();
    }).not.toThrow();
  });
});
