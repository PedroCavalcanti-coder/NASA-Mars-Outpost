import { LINES, type LineId } from './catalog';
export interface Memory {
  introduced: string[];
  mastered: string[];
}
export interface Message {
  id: LineId;
  serial: number;
}
/** Individual educational state only. Never writes simulation or multiplayer state. */
export class GuideEngine {
  memory: Memory;
  current: Message | null = null;
  private queue: LineId[] = [];
  private lastAt = -Infinity;
  private serial = 0;
  constructor(memory?: Memory) {
    this.memory = memory ?? { introduced: [], mastered: [] };
  }
  offer(id: LineId, now: number, urgent = false, repeat = false) {
    if (!repeat && this.memory.introduced.includes(id)) return;
    if (this.current?.id === id || this.queue.includes(id)) return;
    if (urgent) {
      this.current = null;
      this.queue = [];
    }
    this.queue.push(id);
    this.tick(now, urgent);
  }
  tick(now: number, urgent = false) {
    if (this.current || !this.queue.length || (!urgent && now - this.lastAt < 12000)) return;
    const id = this.queue.shift();
    if (!id) return;
    this.current = { id, serial: ++this.serial };
    if (!this.memory.introduced.includes(id)) this.memory.introduced.push(id);
    this.lastAt = now;
  }
  dismiss() {
    this.current = null;
  }
  clear() {
    this.current = null;
    this.queue = [];
  }
  forget(id: LineId) {
    this.memory.introduced = this.memory.introduced.filter((x) => x !== id);
  }
  master(topic: string) {
    if (!this.memory.mastered.includes(topic)) this.memory.mastered.push(topic);
  }
  discard(id: LineId) {
    this.queue = this.queue.filter((x) => x !== id);
    if (this.current?.id === id) this.dismiss();
  }
}
export function readMemory(storage: Pick<Storage, 'getItem'>, key: string): Memory {
  try {
    const data = JSON.parse(storage.getItem(key) ?? 'null');
    if (Array.isArray(data?.introduced) && Array.isArray(data?.mastered))
      return {
        introduced: data.introduced.filter(
          (x: unknown): x is LineId => typeof x === 'string' && Object.hasOwn(LINES, x),
        ),
        mastered: data.mastered.filter((x: unknown) => typeof x === 'string'),
      };
  } catch {
    /* Storage is optional. */
  }
  return { introduced: [], mastered: [] };
}
