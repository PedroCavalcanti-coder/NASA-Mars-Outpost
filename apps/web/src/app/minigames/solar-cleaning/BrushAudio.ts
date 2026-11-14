const CLIPS = Array.from({ length: 6 }, (_, i) => `/assets/audio/brush/brush-${i + 1}.mp3`);

/** Short contact sounds, decoded once per preview; never an endlessly looping track. */
export class BrushAudio {
  private context: AudioContext | null = null;
  private buffers: AudioBuffer[] = [];
  private loading: Promise<void> | null = null;
  private readonly abort = new AbortController();
  private readonly voices = new Map<AudioBufferSourceNode, GainNode>();
  private lastClip = -1;
  private nextAt = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  /** Call directly from a pointer/keyboard gesture to satisfy mobile autoplay policy. */
  unlock() {
    if (this.disposed) return;
    try {
      this.context ??= new AudioContext();
      const context = this.context;
      void context.resume().catch(() => {});
      this.loading ??= Promise.all(
        CLIPS.map(async (url) => {
          const response = await fetch(url, { signal: this.abort.signal });
          if (!response.ok) throw new Error('Brush sound unavailable');
          return context.decodeAudioData(await response.arrayBuffer());
        }),
      )
        .then((buffers) => {
          if (!this.disposed) this.buffers = buffers;
        })
        .catch(() => {
          // Audio is optional: a failed request must never interrupt cleaning.
          this.loading = null;
        });
    } catch {
      /* Devices without Web Audio can still play the minigame. */
    }
  }

  /** Called only when the brush actually removes new dust. */
  contact() {
    const context = this.context;
    if (this.disposed || !context || context.state !== 'running' || !this.buffers.length) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stop(), 100);
    const now = context.currentTime;
    if (now < this.nextAt) return;
    // Pick from every clip except the previous one; vary pitch and strength subtly too.
    const candidates = this.buffers.map((_, i) => i).filter((i) => i !== this.lastClip);
    const index = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    const buffer = this.buffers[index];
    if (!buffer) return;
    this.lastClip = index;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const rate = 0.94 + Math.random() * 0.12;
    const duration = buffer.duration / rate;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0, now);
    const volume = 0.42 + Math.random() * 0.08;
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.setValueAtTime(volume, now + duration - 0.025);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    this.voices.set(source, gain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices.delete(source);
    };
    source.start(now);
    this.nextAt = now + Math.max(0.08, duration - 0.025);
  }

  stop() {
    clearTimeout(this.idleTimer);
    this.nextAt = 0;
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    for (const [source, gain] of this.voices) {
      gain.gain.cancelAndHoldAtTime(now);
      gain.gain.linearRampToValueAtTime(0, now + 0.015);
      source.stop(now + 0.02);
    }
    this.voices.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.stop();
    this.buffers = [];
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
