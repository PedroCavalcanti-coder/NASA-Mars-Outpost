import {
  angleDelta,
  copyMovement,
  MOVEMENT_DT,
  type MovementInput,
  type MovementSnapshot,
  type MovementState,
  movementPath,
  navigationFor,
  openFieldFor,
  type RoverState,
  stepMovement,
} from '@mars/shared';

/** Prediction never changes a server snapshot. Only presentation interpolates remote states. */
export class MovementClient {
  state: MovementState | null = null;
  rover: RoverState | null = null;
  snapshot: MovementSnapshot | null = null;
  private history: { input: MovementInput; scale: number }[] = [];
  private frames: MovementSnapshot[] = [];
  private seq = 0;
  private accumulator = 0;
  private revision = -1;
  /** expedição: campo aberto, sem as estruturas da base (igual ao servidor) */
  field = false;
  private gridNow() {
    return this.field ? openFieldFor(this.base) : navigationFor(this.base);
  }
  private roverRevision = -1;
  private receivedAt = 0;
  correction = 0;
  constructor(
    readonly base: string,
    readonly self: () => string,
    private readonly send: (input: MovementInput) => void,
    private readonly storm = () => false,
  ) {}
  accept(snapshot: MovementSnapshot, receivedAt = performance.now()) {
    if (this.snapshot && snapshot.tick < this.snapshot.tick) return;
    const own = snapshot.players.find((p) => p.id === this.self());
    if (!own) return;
    const changed =
      own.state.revision !== this.revision || snapshot.rover.revision !== this.roverRevision;
    this.history = changed ? [] : this.history.filter(({ input }) => input.seq > own.state.lastSeq);
    if (changed) this.accumulator = 0;
    this.revision = own.state.revision;
    this.roverRevision = snapshot.rover.revision;
    const old = this.state;
    this.state = copyMovement(own.state);
    this.rover = {
      ...copyMovement(snapshot.rover),
      driver: snapshot.rover.driver,
      rider: snapshot.rover.rider,
    };
    this.snapshot = snapshot;
    this.receivedAt = receivedAt;
    this.seq = Math.max(this.seq, own.state.lastSeq);
    for (const entry of this.history) this.predict(entry.input, entry.scale);
    this.correction = old ? Math.hypot(old.x - this.state.x, old.z - this.state.z) : 0;
    this.frames.push(snapshot);
    while (this.frames.length > 20) this.frames.shift();
  }
  get diagnostics() {
    return {
      tick: this.snapshot?.tick,
      confirmedSeq: this.snapshot?.players.find((p) => p.id === this.self())?.state.lastSeq,
      pendingInputs: this.history.length,
      snapshotAgeMs: performance.now() - this.receivedAt,
      correction: this.correction,
    };
  }
  freeze() {
    this.history = [];
    this.accumulator = 0;
  }
  advance(dt: number, intent: Omit<MovementInput, 'seq'>, connected: boolean, scale: number) {
    if (
      !connected ||
      !this.state?.ready ||
      performance.now() - this.receivedAt > 500 ||
      this.history.length > 60
    ) {
      this.freeze();
      return;
    }
    this.accumulator = Math.min(this.accumulator + dt, MOVEMENT_DT * 5);
    while (this.accumulator >= MOVEMENT_DT) {
      this.accumulator -= MOVEMENT_DT;
      const input = { ...intent, seq: ++this.seq };
      this.history.push({ input, scale });
      this.predict(input, scale);
      this.send(input);
    }
  }
  private predict(input: MovementInput, scale: number) {
    const state = this.state,
      rover = this.rover;
    if (!state || !rover) return;
    const vehicle = rover.driver === this.self();
    if (rover.rider === this.self()) return;
    const s = vehicle ? rover : state;
    const grid = this.gridNow();
    const officialInput = {
      ...input,
      sleeping: state.blocked ?? input.sleeping,
      speedScale: state.blocked === undefined ? input.speedScale : 1,
    };
    const bodies = (this.snapshot?.players ?? [])
      .filter(
        (p) =>
          p.id !== this.self() && p.state.ready && p.state.m !== 'drive' && p.state.m !== 'ride',
      )
      .map((p) => ({ x: p.state.x, z: p.state.z, radius: 0.42 }));
    if (!vehicle) bodies.push({ x: rover.x, z: rover.z, radius: 1.5 });
    movementPath(s, officialInput, grid, this.storm(), vehicle, (x, z) =>
      bodies.some((b) => Math.hypot(x - b.x, z - b.z) < b.radius + (vehicle ? 1.5 : 0.42)),
    );
    stepMovement(
      s,
      officialInput,
      grid,
      MOVEMENT_DT * scale * (state.cold ? 0.25 : 1),
      vehicle,
      this.storm(),
      bodies,
    );
    if (vehicle)
      Object.assign(state, { x: rover.x, z: rover.z, h: rover.h, m: 'drive', speed: rover.speed });
  }
  sample(serverNow: number): MovementSnapshot | null {
    const target = serverNow - 100;
    const before = [...this.frames].reverse().find((f) => f.serverNow <= target) ?? this.frames[0];
    const after = this.frames.find((f) => f.serverNow > target) ?? before;
    if (!before || !after) return null;
    const alpha = Math.min(
      1,
      Math.max(0, (target - before.serverNow) / Math.max(1, after.serverNow - before.serverNow)),
    );
    const grid = this.gridNow();
    const interpolate = (a: MovementState, b: MovementState) => {
      if (
        a.revision !== b.revision ||
        a.m !== b.m ||
        !grid.lineClear(a.x, a.z, b.x, b.z, a.m === 'drive' ? 'vehicle' : 'foot')
      )
        return copyMovement(a);
      return {
        ...copyMovement(a),
        x: a.x + (b.x - a.x) * alpha,
        z: a.z + (b.z - a.z) * alpha,
        h: a.h + angleDelta(a.h, b.h) * alpha,
      };
    };
    return {
      ...before,
      players: before.players.map((p) => ({
        ...p,
        state: interpolate(p.state, after.players.find((q) => q.id === p.id)?.state ?? p.state),
      })),
      rover: {
        ...interpolate(before.rover, after.rover),
        driver: before.rover.driver,
        rider: before.rover.rider,
      },
    };
  }
}
