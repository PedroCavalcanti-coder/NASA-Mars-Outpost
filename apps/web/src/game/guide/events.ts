export type Activity = 'solar' | 'oxygen' | 'greenhouse' | 'drill' | 'plant' | 'harvest';
export type GuideEvent =
  | { type: 'ready' }
  | { type: 'moved' }
  | { type: 'complete'; activity: Activity; hit?: boolean }
  | { type: 'progress' }
  | { type: 'difficulty' };
const listeners = new Set<(event: GuideEvent) => void>();
export function emitGuideEvent(event: GuideEvent) {
  for (const listener of listeners) listener(event);
}
export function subscribeGuide(listener: (event: GuideEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let lastProgress = -Infinity;
export function guideProgress() {
  const now = performance.now();
  if (now - lastProgress < 1000) return;
  lastProgress = now;
  emitGuideEvent({ type: 'progress' });
}
