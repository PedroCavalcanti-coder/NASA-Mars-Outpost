import {
  copyMovement,
  duoPartnerPosition,
  footPointNear,
  type GestureStart,
  INPUT_TIMEOUT_MS,
  MOVEMENT_DT,
  type MovementAction,
  type MovementInput,
  type MovementSnapshot,
  type MovementState,
  movementPath,
  navigationData,
  navigationFor,
  openFieldFor,
  neutralInput,
  newMovement,
  PLAYER_RADIUS,
  parseMovementInput,
  type RoverState,
  stepMovement,
  stopMovement,
} from '@mars/shared';

interface Player {
  state: MovementState;
  input: MovementInput;
  queue: MovementInput[];
  receivedSeq: number;
  receivedAt: number;
  lockedUntil: number;
}
/** One authoritative simulation per room. Transport never assigns coordinates. */
export class RoomMovement {
  readonly players = new Map<string, Player>();
  /** a malha em uso: a da base, ou o campo aberto durante a expedição */
  grid: ReturnType<typeof navigationFor>;
  private readonly baseGrid: ReturnType<typeof navigationFor>;
  readonly rover: RoverState;
  private readonly resumes = new Map<string, { state: MovementState; expires: number }>();
  tick = 0;
  /** radiação alta: quem está dentro da base não consegue sair (decidido pelo servidor) */
  exitLock = false;
  private restrictions = new Map<string, { blocked: boolean; cold: boolean; slow?: boolean }>();
  restrict(id: string, restriction: { blocked: boolean; cold: boolean; slow?: boolean }) {
    this.restrictions.set(id, restriction);
    const state = this.players.get(id)?.state;
    if (state) Object.assign(state, { blocked: restriction.blocked, cold: restriction.cold });
  }
  /** Expedição: troca a malha pelo campo aberto (sem as estruturas da base) e volta. */
  setField(on: boolean) {
    this.grid = on ? openFieldFor(this.base) : this.baseGrid;
  }
  /** Leva o rover (e quem está nele) para outro ponto: expedição e volta. */
  teleportRover(pose: { x: number; z: number; h: number }) {
    Object.assign(this.rover, pose);
    stopMovement(this.rover);
    this.rover.revision++;
    for (const id of [this.rover.driver, this.rover.rider]) {
      const p = id ? this.players.get(id) : undefined;
      if (!p) continue;
      Object.assign(p.state, pose);
      stopMovement(p.state);
      p.state.revision++;
      p.queue = [];
      p.input = neutralInput();
    }
  }
  /** Leva um astronauta a pé para outro ponto. */
  teleport(id: string, pose: { x: number; z: number; h: number }) {
    const p = this.players.get(id);
    if (!p) return;
    this.exit(id);
    Object.assign(p.state, pose, { m: 'idle' });
    stopMovement(p.state);
    p.state.revision++;
    p.queue = [];
    p.input = neutralInput();
  }
  constructor(
    readonly base: string,
    parked?: { x: number; z: number; h: number },
  ) {
    this.baseGrid = this.grid = navigationFor(base);
    const initial =
      // rover salvo longe do estacionamento (ficou preso numa expedição): volta para a base
      parked &&
      this.grid.isWalkable(parked.x, parked.z, 'vehicle') &&
      Math.hypot(parked.x - navigationData(base).park.x, parked.z - navigationData(base).park.z) < 40
        ? parked
        : navigationData(base).park;
    this.rover = { ...newMovement(initial), ready: true, driver: null, rider: null };
  }
  join(id: string, slot: number, token?: string, now = Date.now()) {
    for (const [key, value] of this.resumes) if (value.expires < now) this.resumes.delete(key);
    const old = token ? this.resumes.get(token) : undefined;
    const state = old
      ? copyMovement(old.state)
      : newMovement(navigationData(this.base).spawns[slot]!);
    if (token) this.resumes.delete(token);
    stopMovement(state);
    state.m = 'idle';
    state.lastSeq = 0;
    state.revision++;
    this.players.set(id, {
      state,
      input: neutralInput(),
      queue: [],
      receivedSeq: 0,
      receivedAt: now,
      lockedUntil: 0,
    });
    return state;
  }
  remove(id: string, token?: string, now = Date.now()) {
    const p = this.players.get(id);
    if (!p) return;
    this.exit(id);
    stopMovement(p.state);
    if (token) this.resumes.set(token, { state: copyMovement(p.state), expires: now + 120_000 });
    this.players.delete(id);
    this.restrictions.delete(id);
  }
  input(id: string, raw: unknown, now: number) {
    const p = this.players.get(id),
      input = parseMovementInput(raw);
    if (!p || !input || input.seq <= p.receivedSeq || p.queue.length >= 8) return false;
    // A faster sender cannot buy extra simulation time.
    p.receivedSeq = input.seq;
    p.receivedAt = now;
    p.queue.push(input);
    return true;
  }
  private bodies(except: string, vehicle = false) {
    const bodies = [...this.players]
      .filter(
        ([id, p]) =>
          id !== except && p.state.ready && p.state.m !== 'drive' && p.state.m !== 'ride',
      )
      .map(([, p]) => ({ x: p.state.x, z: p.state.z, radius: PLAYER_RADIUS }));
    if (!vehicle) bodies.push({ x: this.rover.x, z: this.rover.z, radius: 1.5 });
    return bodies;
  }
  action(id: string, action: MovementAction): string | null {
    const p = this.players.get(id);
    if (!p) return 'Astronauta indisponível.';
    const s = p.state;
    if (action === 'ready') {
      s.ready = true;
      return null;
    }
    if (action === 'exit') {
      this.exit(id);
      return null;
    }
    if (action === 'infirmary') {
      this.exit(id);
      const point = navigationData(this.base).infirmary;
      if (!point) return 'Enfermaria indisponível.';
      Object.assign(s, { x: point.x, z: point.z, m: 'idle' });
      stopMovement(s);
      s.revision++;
      p.queue = [];
      p.input = neutralInput();
      p.lockedUntil = 0;
      return null;
    }
    if (action !== 'enter') return 'Ação inválida.';
    if (!s.ready || p.lockedUntil > Date.now() || p.input.sleeping || p.input.activity !== 'idle')
      return 'Astronauta ocupado.';
    if (s.m === 'drive' || s.m === 'ride') return null;
    if (Math.hypot(s.x - this.rover.x, s.z - this.rover.z) > 4.2)
      return 'Chegue mais perto do rover.';
    if (this.rover.driver && this.rover.rider) return 'O rover está cheio.';
    stopMovement(s);
    p.queue = [];
    p.input = neutralInput();
    s.revision++;
    if (!this.rover.driver) {
      this.rover.driver = id;
      s.m = 'drive';
      stopMovement(this.rover);
      this.rover.revision++;
    } else {
      this.rover.rider = id;
      s.m = 'ride';
    }
    s.x = this.rover.x;
    s.z = this.rover.z;
    s.h = this.rover.h;
    return null;
  }
  exit(id: string) {
    const p = this.players.get(id);
    if (!p || (this.rover.driver !== id && this.rover.rider !== id)) return;
    if (this.rover.driver === id) {
      const rider = this.rover.rider;
      this.rover.driver = null;
      stopMovement(this.rover);
      this.rover.revision++;
      if (rider) this.exit(rider);
    }
    if (this.rover.rider === id) this.rover.rider = null;
    const point = footPointNear(this.grid, this.rover, this.bodies(id)) ?? {
      x: p.state.x,
      z: p.state.z,
    };
    Object.assign(p.state, point, { m: 'idle', h: this.rover.h });
    stopMovement(p.state);
    p.state.revision++;
    p.queue = [];
    p.input = neutralInput();
  }
  gesture(start: GestureStart): boolean {
    const a = this.players.get(start.a),
      b = this.players.get(start.b);
    if (!a || !b || a.lockedUntil > start.at || b.lockedUntil > start.at) return false;
    const heading = Math.atan2(b.state.x - a.state.x, b.state.z - a.state.z);
    const spot = duoPartnerPosition(start.gesture, a.state.x, a.state.z, heading);
    if (
      !this.grid.isWalkable(spot.x, spot.z) ||
      !this.grid.lineClear(b.state.x, b.state.z, spot.x, spot.z)
    )
      return false;
    const blockers = this.bodies(start.b).filter(
      (p) => Math.hypot(p.x - a.state.x, p.z - a.state.z) > 0.001,
    );
    if (blockers.some((p) => Math.hypot(p.x - spot.x, p.z - spot.z) < p.radius + PLAYER_RADIUS))
      return false;
    const seconds =
      { high_five: 1.6667, handshake: 2.4167, fist_bump: 1.8334, hug: 3 }[start.gesture] + 0.25;
    start.poses = {
      a: { x: a.state.x, z: a.state.z, h: heading },
      b: { x: spot.x, z: spot.z, h: heading + Math.PI },
    };
    for (const [p, pose] of [
      [a, start.poses.a],
      [b, start.poses.b],
    ] as const) {
      stopMovement(p.state);
      Object.assign(p.state, pose);
      p.state.revision++;
      p.queue = [];
      p.input = neutralInput();
      p.lockedUntil = start.at + seconds * 1000;
    }
    return true;
  }
  step(now: number, scale: number, storm: boolean) {
    this.tick++;
    const dt = MOVEMENT_DT * scale;
    for (const [id, p] of [...this.players].sort(([a], [b]) => a.localeCompare(b))) {
      if (now - p.receivedAt > INPUT_TIMEOUT_MS) {
        p.queue = [];
        p.input = neutralInput(p.receivedSeq);
        stopMovement(p.state);
        if (this.rover.driver === id) stopMovement(this.rover);
      }
      const input = p.queue.shift();
      if (input) {
        p.input = input;
        p.state.lastSeq = input.seq;
      }
      if (p.lockedUntil > now) {
        stopMovement(p.state);
        continue;
      }
      const driving = this.rover.driver === id;
      if (this.rover.rider === id || !p.state.ready) continue;
      const s = driving ? this.rover : p.state;
      const bodies = this.bodies(id, driving);
      const restriction = this.restrictions.get(id);
      const officialInput = {
        ...p.input,
        sleeping: restriction?.blocked ?? true,
        speedScale: 1,
        exitBlocked: p.input.exitBlocked || this.exitLock,
      };
      movementPath(s, officialInput, this.grid, storm, driving, (x, z) =>
        bodies.some(
          (b) => Math.hypot(x - b.x, z - b.z) < b.radius + (driving ? 1.5 : PLAYER_RADIUS),
        ),
      );
      stepMovement(
        s,
        officialInput,
        this.grid,
        dt * (restriction?.cold ? 0.25 : restriction?.slow ? 0.55 : 1),
        driving,
        storm,
        bodies,
      );
      // Repath a blocked click route from the authority, at a bounded frequency.
      if (s.path.length && Math.hypot(s.vx, s.vz) < 0.05 && this.tick % 15 === 0)
        s.destination = null;
    }
    for (const [id, p] of this.players)
      if (id === this.rover.driver || id === this.rover.rider) {
        Object.assign(p.state, {
          x: this.rover.x,
          z: this.rover.z,
          h: this.rover.h,
          m: id === this.rover.driver ? 'drive' : 'ride',
          speed: this.rover.speed,
        });
      }
  }
  snapshot(now: number, scale: number): MovementSnapshot {
    return {
      tick: this.tick,
      serverNow: now,
      scale,
      players: [...this.players].map(([id, p]) => ({
        id,
        state: copyMovement(p.state),
        inside: this.grid.isInsideBase(p.state.x, p.state.z),
        room: this.grid.roomIdAt(p.state.x, p.state.z),
      })),
      rover: { ...copyMovement(this.rover), driver: this.rover.driver, rider: this.rover.rider },
    };
  }
}
