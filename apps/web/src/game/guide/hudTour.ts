import type { LineId } from './catalog';
import type { Memory } from './engine';

export const HUD_LESSONS = [
  { id: 'hudOxygen', target: 'personal-oxygen' },
  { id: 'hudCycle', target: 'day-cycle' },
  { id: 'hudEnergy', target: 'energy' },
  { id: 'hudSupplies', target: 'supplies' },
  { id: 'hudResearch', target: 'research' },
  { id: 'hudEvents', target: 'events' },
  { id: 'hudSpeed', target: 'speed' },
  { id: 'hudCrew', target: 'crew' },
  { id: 'hudChat', target: 'chat' },
  { id: 'hudSettings', target: 'settings' },
] as const satisfies readonly { id: LineId; target: string }[];
export const HUD_TOUR_SKIPPED = 'hud-tour-skipped';
export type HudLesson = (typeof HUD_LESSONS)[number];
export function hudLesson(id?: LineId): HudLesson | undefined {
  return HUD_LESSONS.find((lesson) => lesson.id === id);
}
export function nextHudLesson(memory: Memory, available: (target: string) => boolean = () => true) {
  if (memory.mastered.includes(HUD_TOUR_SKIPPED)) return undefined;
  return HUD_LESSONS.find(
    (lesson) => !memory.mastered.includes(lesson.id) && available(lesson.target),
  );
}
export function spotlightTarget(id?: LineId) {
  if (id === 'low' || id === 'recovered') return 'personal-oxygen';
  if (id === 'blackout') return 'energy';
  if (id === 'storm') return 'events';
  if (id === 'save') return 'settings';
  if (id === 'resources') return 'energy';
  if (id === 'events') return 'events';
  if (id === 'goal' || id === 'sendData') return 'research';
  return hudLesson(id)?.target;
}
export function targetSelector(target: string) {
  return `[data-bit-target="${target}"]`;
}
