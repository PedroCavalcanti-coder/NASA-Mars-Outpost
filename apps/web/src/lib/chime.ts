import { useGameSettings } from './gameSettings';

let ctx: AudioContext | null = null;

/** Toca uma sequência curta de notas (acerto, vitória, radar). Respeita o volume e o mudo. */
export function chime(freqs: number[], gap = 0.11, type: OscillatorType = 'triangle', gain = 0.07) {
  const a = useGameSettings.getState().audio;
  if (a.muted) return;
  try {
    ctx ??= new AudioContext();
    const vol = (a.masterVolume * a.sfxVolume) / 10000;
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const t = ctx!.currentTime + i * gap;
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(gain * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
      o.connect(g);
      g.connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.25);
    });
  } catch {
    /* som é opcional */
  }
}
