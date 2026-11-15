// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { useA11y } from './accessibility';
import { speak } from './narration';

describe('narração', () => {
  it('desligada, não fala nada', () => {
    const speakFn = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak: speakFn, cancel: vi.fn(), getVoices: () => [], pending: false };
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { text: string; constructor(t: string) { this.text = t; } };
    useA11y.setState({ narrate: false });
    speak('Olá');
    expect(speakFn).not.toHaveBeenCalled();
  });
  it('ligada, lê o texto sem emojis e no ritmo escolhido', () => {
    const speakFn = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak: speakFn, cancel: vi.fn(), getVoices: () => [], pending: false };
    useA11y.setState({ narrate: true, narrateSlow: true });
    speak('Radiação alta ☢️ lá fora!');
    const u = speakFn.mock.calls[0]![0] as { text: string; rate: number };
    expect(u.text).toBe('Radiação alta lá fora!');
    expect(u.rate).toBeCloseTo(0.85);
  });
});
