/** Regras compartilhadas: segundos virtuais para perigos, tempo real para reservas. */
export const BASE_EVENTS = [
  { id: 'micrometeorite', title: 'Micrometeoritos', weight: 30, damage: 30, duration: 18 },
  { id: 'dust_storm', title: 'Tempestade de poeira', weight: 20, damage: 20, duration: 135 },
  { id: 'thermal_crack', title: 'Fratura térmica', weight: 15, damage: 15, duration: 18 },
  { id: 'discovery', title: 'Achado geológico', weight: 15, damage: 0, duration: 5 },
  { id: 'supply_drop', title: 'Cápsula de mantimentos', weight: 10, damage: 0, duration: 20 },
  { id: 'cleaning_wind', title: 'Vento de limpeza', weight: 10, damage: 0, duration: 20 },
] as const;
export type BaseEventId = (typeof BASE_EVENTS)[number]['id'];
export interface Fracture {
  id: number;
  anchor: number;
  damage: number;
  nextDecay: number;
  tutorial: boolean;
  plate: boolean;
  screws: number[];
  owner?: string;
  leaseUntil?: number;
  stepAt?: number;
}
export interface IntegrityState {
  revision: number;
  seed: number;
  seq: number;
  tutorial: 'waiting' | 'active' | 'done';
  nextAt: number;
  fractures: Fracture[];
  event?: { id: BaseEventId; seq: number; start: number; applied: boolean };
  previous?: BaseEventId;
  positives: number;
  credits: { research: number; supplies: number };
  wind: number;
  stopped?: boolean;
}
export type RepairIntent =
  | {
      op: 'reserve' | 'heartbeat' | 'release' | 'plate' | 'screw';
      fracture: number;
      screw?: number;
    }
  | { op: 'ready' }
  /** decisão de um evento da base: positivo abre/agrava fraturas; negativo cura a pior (-30..30) */
  | { op: 'damage'; amount: number }
  | { op: 'stop' }
  | { op: 'restart' }
  | { op: 'event'; event: BaseEventId }
  | { op: 'emergency' };
export const armorValue = (s: IntegrityState) =>
  Math.max(0, 100 - s.fractures.reduce((n, f) => n + f.damage, 0));
export const leakRate = (s: IntegrityState) =>
  s.fractures.reduce((n, f) => n + f.damage, 0) * 0.006;
export function newIntegrity(seed = 1): IntegrityState {
  return {
    revision: 0,
    seed: seed >>> 0,
    seq: 0,
    tutorial: 'waiting',
    nextAt: Infinity,
    fractures: [],
    positives: 0,
    credits: { research: 0, supplies: 0 },
    wind: 0,
  };
}
function random(s: IntegrityState) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function schedule(s: IntegrityState, t: number) {
  s.nextAt = t + 240 + 60 * random(s);
}
function fracture(s: IntegrityState, t: number, damage: number, tutorial = false) {
  const available = [0, 1, 2, 3, 4, 5].filter((a) => !s.fractures.some((f) => f.anchor === a));
  if (s.fractures.length >= 3 || !available.length) return;
  s.fractures.push({
    id: ++s.seq,
    anchor: available[Math.floor(random(s) * available.length)]!,
    damage,
    nextDecay: t + 120,
    tutorial,
    plate: false,
    screws: [],
  });
}
export function tickIntegrity(s: IntegrityState, t: number, real: number, hour: number) {
  const before = JSON.stringify(s);
  for (const f of s.fractures) {
    if (f.owner && (f.leaseUntil ?? 0) < real) {
      delete f.owner;
      delete f.leaseUntil;
      f.nextDecay = Math.max(f.nextDecay, t + 120);
    }
    if (!s.stopped && !f.tutorial && !f.owner && t >= f.nextDecay) {
      f.damage = Math.min(40, f.damage + 5 * Math.max(1, Math.floor((t - f.nextDecay) / 120) + 1));
      f.nextDecay = t + 120;
    }
  }
  if (!s.stopped) {
    if (s.tutorial === 'waiting' && t >= s.nextAt) {
      fracture(s, t, 10, true);
      s.tutorial = 'active';
    }
    if (s.event) {
      const e = BASE_EVENTS.find((e) => e.id === s.event!.id)!;
      const age = t - s.event.start;
      const impact = e.id === 'dust_storm' ? 45 : e.id === 'supply_drop' ? 18 : e.damage ? 15 : 0;
      if (!s.event.applied && age >= impact) {
        s.event.applied = true;
        if (e.damage) fracture(s, t, e.damage);
        if (e.id === 'discovery') s.credits.research += 8;
        if (e.id === 'supply_drop') s.credits.supplies += 20;
        if (e.id === 'cleaning_wind') s.wind++;
      }
      if (age >= e.duration) {
        s.previous = e.id;
        s.event = undefined;
        schedule(s, t);
      }
    } else if (s.tutorial === 'done' && t >= s.nextAt) {
      let pool = BASE_EVENTS.filter(
        (e) =>
          e.id !== s.previous &&
          (!e.damage || s.fractures.length < 3) &&
          (e.id !== 'thermal_crack' || hour < 6 || hour >= 18),
      );
      if (s.positives >= 2 && pool.some((e) => e.damage)) pool = pool.filter((e) => e.damage);
      let n = random(s) * pool.reduce((n, e) => n + e.weight, 0);
      const e = pool.find((e) => (n -= e.weight) < 0) ?? pool[0]!;
      s.event = { id: e.id, seq: ++s.seq, start: t, applied: false };
      s.positives = e.damage ? 0 : s.positives + 1;
    }
  }
  if (JSON.stringify(s) !== before) s.revision++;
}
export function repairIntent(
  s: IntegrityState,
  p: RepairIntent,
  actor: string,
  t: number,
  real: number,
  dev = false,
): boolean {
  if (p.op === 'restart') {
    const next = newIntegrity(s.seed + 1);
    next.revision = s.revision + 1;
    next.seq = s.seq;
    next.nextAt = t + 60;
    for (const key of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[key];
    Object.assign(s, next);
    return true;
  }
  if (p.op === 'ready') {
    if (s.tutorial === 'waiting' && !Number.isFinite(s.nextAt)) {
      s.nextAt = t + 60;
      s.revision++;
    }
    return true;
  }
  if (p.op === 'stop') {
    s.stopped = true;
    s.event = undefined;
    s.revision++;
    return true;
  }
  if (p.op === 'event') {
    if (!dev || s.event || !BASE_EVENTS.some((e) => e.id === p.event)) return false;
    s.event = { id: p.event, seq: ++s.seq, start: t, applied: false };
    s.revision++;
    return true;
  }
  if (p.op === 'damage') {
    const amount = Math.max(-30, Math.min(30, Math.round(p.amount)));
    if (!amount) return false;
    if (amount > 0) {
      if (s.fractures.length < 3) fracture(s, t, Math.min(40, amount));
      else {
        const worst = [...s.fractures].sort((a, b) => a.damage - b.damage)[0];
        if (worst) worst.damage = Math.min(40, worst.damage + amount);
      }
    } else {
      const worst = [...s.fractures].sort((a, b) => b.damage - a.damage)[0];
      if (!worst) return false;
      worst.damage += amount;
      if (worst.damage <= 0) s.fractures = s.fractures.filter((f) => f !== worst);
    }
    s.revision++;
    return true;
  }
  if (p.op === 'emergency') {
    if (!dev) return false;
    while (s.fractures.length < 3) fracture(s, t, 40);
    s.fractures.forEach((f) => (f.damage = 40));
    s.revision++;
    return true;
  }
  const f = s.fractures.find((f) => f.id === p.fracture);
  if (!f) return false;
  if (p.op === 'reserve') {
    if (f.owner && f.owner !== actor && (f.leaseUntil ?? 0) > real) return false;
    f.owner = actor;
    f.leaseUntil = real + 10000;
  } else {
    if (f.owner !== actor || (f.leaseUntil ?? 0) < real) return false;
    if (p.op === 'release') {
      delete f.owner;
      delete f.leaseUntil;
      f.nextDecay = t + 120;
    } else if (p.op === 'heartbeat') f.leaseUntil = real + 10000;
    else if (p.op === 'plate') {
      f.plate = true;
      f.stepAt = real;
    } else if (p.op === 'screw') {
      if (
        real - (f.stepAt ?? 0) < 900 ||
        !f.plate ||
        !Number.isInteger(p.screw) ||
        p.screw! < 0 ||
        p.screw! > 3
      )
        return false;
      if (!f.screws.includes(p.screw!)) {
        f.screws.push(p.screw!);
        f.stepAt = real;
      }
      if (f.screws.length === 4) {
        s.fractures = s.fractures.filter((x) => x !== f);
        if (f.tutorial) {
          s.tutorial = 'done';
          schedule(s, t);
        }
      }
    }
  }
  s.revision++;
  return true;
}
/** Accept only persisted data produced by this version; transient locks are never restored. */
export function restoreIntegrity(raw: unknown): IntegrityState | undefined {
  if (!raw || typeof raw !== 'object') return;
  const s = JSON.parse(JSON.stringify(raw)) as IntegrityState;
  if (
    !Array.isArray(s.fractures) ||
    !s.credits ||
    !Number.isFinite(s.seed) ||
    !Number.isFinite(s.revision)
  )
    return;
  s.fractures = s.fractures
    .slice(0, 3)
    .filter(
      (f) => Number.isInteger(f.id) && Number.isInteger(f.anchor) && f.anchor >= 0 && f.anchor < 6,
    )
    .map((f) => ({
      ...f,
      damage: Math.max(0, Math.min(40, Number(f.damage) || 0)),
      nextDecay: Number(f.nextDecay) || 120,
      screws: Array.isArray(f.screws)
        ? [...new Set(f.screws.filter((n) => Number.isInteger(n) && n >= 0 && n <= 3))]
        : [],
      owner: undefined,
      leaseUntil: undefined,
    }));
  if (s.event && !BASE_EVENTS.some((e) => e.id === s.event!.id)) s.event = undefined;
  if (s.nextAt === null) s.nextAt = Infinity;
  return s;
}
