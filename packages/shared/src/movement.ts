import { Vector3 } from 'three';
import type { GameMotion, GameMotionKind } from './game';
import {
  type BaseFullLayout,
  NavigationGrid,
  OpenFieldGrid,
  PLAYER_RADIUS,
  STORM_SAFE_RADIUS,
  VEHICLE_RADIUS,
} from './navigation';
import { NAVIGATION_DATA, NAVIGATION_HASH } from './navigationData';

export { NAVIGATION_HASH };
export const MOVEMENT_VERSION = 2;
export const MOVEMENT_DT = 1 / 30;
export const INPUT_TIMEOUT_MS = 250;
export interface MapPoint {
  x: number;
  z: number;
}
export interface MovementInput {
  seq: number;
  direction: MapPoint | null;
  destination: MapPoint | null;
  manual: { throttle: number; steer: number } | null;
  sleeping: boolean;
  speedScale: number;
  exitBlocked: boolean;
  activity: 'idle' | 'clean' | 'plant' | 'harvest';
  face: number;
}
export interface MovementState extends GameMotion {
  /** Restrictions chosen by the gameplay authority; included for matching prediction. */
  blocked?: boolean;
  cold?: boolean;
  vx: number;
  vz: number;
  speed: number;
  path: MapPoint[];
  destination: MapPoint | null;
  lastSeq: number;
  ready: boolean;
  revision: number;
}
export interface RoverState extends MovementState {
  driver: string | null;
  rider: string | null;
}
export interface MovementPlayerSnapshot {
  id: string;
  state: MovementState;
  inside: boolean;
  room: string | null;
}
export interface MovementSnapshot {
  tick: number;
  serverNow: number;
  scale: number;
  players: MovementPlayerSnapshot[];
  rover: RoverState;
}
export type MovementAction = 'enter' | 'exit' | 'infirmary' | 'ready';
export interface MovementActionResult {
  ok: boolean;
  error?: string;
  snapshot: MovementSnapshot;
}
const grids = new Map<string, NavigationGrid>();
export function navigationData(base: string) {
  const data = NAVIGATION_DATA[base as keyof typeof NAVIGATION_DATA];
  if (!data) throw new Error('Base desconhecida');
  return data;
}
export function navigationFor(base: string) {
  let grid = grids.get(base);
  if (!grid) {
    const data = navigationData(base);
    grid = new NavigationGrid(data.layout as unknown as BaseFullLayout);
    grid.importMasks(data.masks);
    grids.set(base, grid);
  }
  return grid;
}
const fields = new Map<string, NavigationGrid>();
/** Campo aberto (sem estruturas) da expedição, no mesmo tamanho do mapa da base. */
export function openFieldFor(base: string) {
  let grid = fields.get(base);
  if (!grid) {
    grid = new OpenFieldGrid(navigationData(base).layout as unknown as BaseFullLayout);
    fields.set(base, grid);
  }
  return grid;
}
export function newMovement(at: MapPoint & { h?: number }): MovementState {
  return {
    x: at.x,
    z: at.z,
    h: at.h ?? 0,
    m: 'idle',
    vx: 0,
    vz: 0,
    speed: 0,
    path: [],
    destination: null,
    lastSeq: 0,
    ready: false,
    revision: 0,
  };
}
export function neutralInput(seq = 0): MovementInput {
  return {
    seq,
    direction: null,
    destination: null,
    manual: null,
    sleeping: false,
    speedScale: 1,
    exitBlocked: false,
    activity: 'idle',
    face: 0,
  };
}
export function parseMovementInput(raw: unknown): MovementInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(r.seq) || (r.seq as number) <= 0) return null;
  const number = (n: unknown, limit: number): n is number =>
    typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit;
  const point = (p: unknown, limit: number): MapPoint | null => {
    if (!p || typeof p !== 'object') return null;
    const v = p as Record<string, unknown>;
    return number(v.x, limit) && number(v.z, limit) ? { x: v.x, z: v.z } : null;
  };
  if (r.direction != null && !point(r.direction, 1)) return null;
  if (r.destination != null && !point(r.destination, 78)) return null;
  const dir = point(r.direction, 1);
  const len = dir ? Math.max(1, Math.hypot(dir.x, dir.z)) : 1;
  let manual: MovementInput['manual'] = null;
  if (r.manual != null) {
    const m = r.manual as Record<string, unknown>;
    if (!number(m.throttle, 1) || !number(m.steer, 1)) return null;
    manual = { throttle: m.throttle, steer: m.steer };
  }
  return {
    seq: r.seq as number,
    direction: dir ? { x: dir.x / len, z: dir.z / len } : null,
    destination: point(r.destination, 78),
    manual,
    sleeping: r.sleeping === true,
    speedScale: number(r.speedScale, 1) ? Math.max(0.1, r.speedScale) : 1,
    exitBlocked: r.exitBlocked === true,
    activity:
      r.activity === 'clean' || r.activity === 'plant' || r.activity === 'harvest'
        ? r.activity
        : 'idle',
    face: number(r.face, 10000) ? r.face : 0,
  };
}
export function stopMovement(s: MovementState) {
  s.vx = s.vz = s.speed = 0;
  s.path = [];
  s.destination = null;
  if (s.m !== 'drive' && s.m !== 'ride') s.m = 'idle';
}
export function copyMovement(s: MovementState): MovementState {
  return {
    ...s,
    path: s.path.map((p) => ({ ...p })),
    destination: s.destination ? { ...s.destination } : null,
  };
}
export function angleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
export function movementPath(
  s: MovementState,
  input: MovementInput,
  grid: NavigationGrid,
  storm: boolean,
  vehicle: boolean,
  blocker?: (x: number, z: number) => boolean,
) {
  if (input.direction || input.manual || input.sleeping || input.activity !== 'idle') {
    s.path = [];
    s.destination = null;
    return;
  }
  const dest = input.destination;
  if (!dest) {
    s.path = [];
    s.destination = null;
    return;
  }
  if (s.destination?.x === dest.x && s.destination?.z === dest.z) return;
  s.destination = { ...dest };
  s.path = grid
    .findPath(
      new Vector3(s.x, 0, s.z),
      new Vector3(dest.x, 0, dest.z),
      storm,
      blocker,
      vehicle ? 'vehicle' : 'foot',
    )
    .path.map((p) => ({ x: p.x, z: p.z }));
}
export interface Body extends MapPoint {
  radius: number;
}
/** Pure fixed-step physics used by the authority and local prediction. No camera or scene transforms. */
export function stepMovement(
  s: MovementState,
  input: MovementInput,
  grid: NavigationGrid,
  dt: number,
  vehicle = false,
  storm = false,
  others: readonly Body[] = [],
) {
  if (!s.ready || dt <= 0) return;
  if (input.sleeping || input.activity !== 'idle') {
    stopMovement(s);
    s.m = input.activity;
    s.h = input.face;
    return;
  }
  let direction = input.direction;
  let remaining = Infinity;
  if (!direction && !input.manual && s.path.length) {
    let target = s.path[0]!;
    while (
      s.path.length > 1 &&
      Math.hypot(target.x - s.x, target.z - s.z) < (vehicle ? 2.4 : 0.3)
    ) {
      s.path.shift();
      target = s.path[0]!;
    }
    const dx = target.x - s.x,
      dz = target.z - s.z;
    remaining = Math.hypot(dx, dz);
    if (remaining < (vehicle ? 1 : 0.1)) s.path.shift();
    else direction = { x: dx / remaining, z: dz / remaining };
  }
  let vx: number, vz: number;
  if (vehicle) {
    let targetSpeed = 0,
      curvature = 0;
    if (input.manual) {
      targetSpeed = input.manual.throttle > 0 ? 8.5 : input.manual.throttle < 0 ? -3.2 : 0;
      curvature = input.manual.steer / 2.4;
    } else if (direction) {
      let diff = angleDelta(s.h, Math.atan2(direction.x, direction.z));
      const reverse = Math.cos(diff) < -0.25 && (!!input.direction || remaining < 18);
      if (reverse) diff += diff > 0 ? -Math.PI : Math.PI;
      const sign = reverse ? -1 : 1;
      curvature = sign * Math.max(-1 / 2.4, Math.min(1 / 2.4, diff * 1.4));
      const limit =
        s.path.length === 1
          ? Math.min(8.5, Math.sqrt(2 * 12 * 0.7 * Math.max(0, remaining - 0.4)) + 0.8)
          : 8.5;
      targetSpeed = sign * (reverse ? Math.min(limit, 3) : limit) * Math.max(0.3, Math.cos(diff));
    }
    const rate = Math.abs(targetSpeed) > Math.abs(s.speed) ? 7 : 12;
    s.speed +=
      Math.sign(targetSpeed - s.speed) * Math.min(Math.abs(targetSpeed - s.speed), rate * dt);
    s.h += s.speed * curvature * dt;
    vx = Math.sin(s.h) * s.speed;
    vz = Math.cos(s.h) * s.speed;
  } else {
    const max =
      Math.min(3.8, s.path.length === 1 ? Math.sqrt(2 * 26 * 0.55 * remaining) + 0.35 : 3.8) *
      input.speedScale;
    let tx = (direction?.x ?? 0) * max,
      tz = (direction?.z ?? 0) * max;
    const speed = Math.hypot(s.vx, s.vz);
    if (direction && speed > 0.5) {
      const slow = 0.5 + 0.5 * Math.max(0, (s.vx * direction.x + s.vz * direction.z) / speed);
      tx *= slow;
      tz *= slow;
    }
    const dx = tx - s.vx,
      dz = tz - s.vz,
      length = Math.hypot(dx, dz);
    const k = length > 0 ? Math.min(length, (direction ? 20 : 26) * dt) / length : 0;
    vx = s.vx + dx * k;
    vz = s.vz + dz * k;
    if (Math.hypot(vx, vz) > 0.05)
      s.h +=
        Math.sign(angleDelta(s.h, Math.atan2(vx, vz))) *
        Math.min(Math.abs(angleDelta(s.h, Math.atan2(vx, vz))), 14 * dt);
  }
  let nx = s.x + vx * dt,
    nz = s.z + vz * dt;
  const radius = vehicle ? VEHICLE_RADIUS : PLAYER_RADIUS;
  for (const o of others) {
    const dx = nx - o.x,
      dz = nz - o.z,
      d = Math.hypot(dx, dz),
      min = radius + o.radius;
    const before = Math.hypot(s.x - o.x, s.z - o.z);
    if (d >= min || (d > before && before < min)) continue;
    const push = min - d;
    nx += (d > 0.0001 ? dx / d : 1) * push;
    nz += (d > 0.0001 ? dz / d : 0) * push;
  }
  const allowed = (x: number, z: number) =>
    grid.isWalkable(x, z, vehicle ? 'vehicle' : 'foot') &&
    (!storm || Math.hypot(x, z) <= STORM_SAFE_RADIUS || Math.hypot(x, z) < Math.hypot(s.x, s.z)) &&
    (!input.exitBlocked || !grid.isInsideBase(s.x, s.z) || grid.isInsideBase(x, z));
  if (!allowed(nx, nz) || !grid.lineClear(s.x, s.z, nx, nz, vehicle ? 'vehicle' : 'foot')) {
    if (allowed(nx, s.z) && grid.lineClear(s.x, s.z, nx, s.z, vehicle ? 'vehicle' : 'foot')) {
      nz = s.z;
      vz = 0;
    } else if (
      allowed(s.x, nz) &&
      grid.lineClear(s.x, s.z, s.x, nz, vehicle ? 'vehicle' : 'foot')
    ) {
      nx = s.x;
      vx = 0;
    } else {
      nx = s.x;
      nz = s.z;
      vx = vz = 0;
    }
    if (vehicle) s.speed *= 0.5;
  }
  s.m = vehicle ? 'drive' : Math.hypot(nx - s.x, nz - s.z) > 0.001 ? 'walk' : 'idle';
  s.x = nx;
  s.z = nz;
  s.vx = vx;
  s.vz = vz;
  s.h = Math.atan2(Math.sin(s.h), Math.cos(s.h));
}
export function footPointNear(
  grid: NavigationGrid,
  at: MapPoint & { h: number },
  others: readonly Body[] = [],
) {
  for (const radius of [2.5, 3.2, 4])
    for (const turn of [Math.PI / 2, -Math.PI / 2, Math.PI, 0, 2.2, -2.2]) {
      const x = at.x + Math.sin(at.h + turn) * radius,
        z = at.z + Math.cos(at.h + turn) * radius;
      if (
        grid.isWalkable(x, z) &&
        others.every((p) => Math.hypot(p.x - x, p.z - z) >= PLAYER_RADIUS + p.radius)
      )
        return { x, z };
    }
  return grid.nearestWalkablePoint(at.x, at.z, 30);
}
