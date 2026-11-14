import { useSyncExternalStore } from 'react';

export type ClockScale = 1 | 2 | 3;

/** Duração de um Sol marciano em segundos reais do simulador (10 minutos = 600 s). */
export const SOL_DURATION_SECONDS = 600;
export const HOURS_PER_SOL = 24;
export const SECONDS_PER_MARS_HOUR = SOL_DURATION_SECONDS / HOURS_PER_SOL;

export interface ClockRoomDelegate {
  readonly isCoordinator: boolean | (() => boolean);
  playerCount(): number;
  sendTime(paused: boolean, scale: ClockScale): void;
  onTimeChange?(paused: boolean, scale: ClockScale): void;
}

export interface GameClockSnapshot {
  paused: boolean;
  scale: ClockScale;
  effectiveScale: number;
  simTime: number;
  canControl: boolean;
  isCoordinator: boolean;
  playerCount: number;
}

/**
 * Converte hora decimal marciana (0..24) em formato LMST "HH:MM".
 */
export function hoursToLMST(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.floor((normalized % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Retorna se a hora marciana corresponde ao período diurno (06:00 às 18:00 LMST).
 */
export function isDaytime(hour: number): boolean {
  const normalized = ((hour % 24) + 24) % 24;
  return normalized >= 6 && normalized < 18;
}

/**
 * Calcula o Sol e a hora a partir de segundos acumulados de simulação.
 * Inicia às 09:00 LMST do Sol 1.
 */
export function simTimeToSolHour(
  simTimeSeconds: number,
  startHour = 9,
): { sol: number; hour: number; formatted: string; isDay: boolean } {
  const totalHours =
    startHour + (Math.max(0, simTimeSeconds) * HOURS_PER_SOL) / SOL_DURATION_SECONDS;
  const hour = totalHours % HOURS_PER_SOL;
  const sol = 1 + Math.floor(totalHours / HOURS_PER_SOL);
  return {
    sol,
    hour,
    formatted: hoursToLMST(hour),
    isDay: isDaytime(hour),
  };
}

/**
 * Relógio da simulação do jogo.
 * Dono principal: Conversa 3. Casca e tomada combinada criadas pela Conversa 0.
 * Suporta acesso por instância (`new GameClock()`) e estático (`GameClock.paused`).
 */
export class GameClock {
  private static _defaultInstance: GameClock | null = null;

  static get defaultInstance(): GameClock {
    if (!GameClock._defaultInstance) {
      GameClock._defaultInstance = new GameClock();
    }
    return GameClock._defaultInstance;
  }

  static get paused(): boolean {
    return GameClock.defaultInstance.isPaused();
  }

  static set paused(val: boolean) {
    GameClock.defaultInstance.setPaused(val);
  }

  static get scale(): ClockScale {
    return GameClock.defaultInstance.getScale();
  }

  static set scale(val: ClockScale) {
    GameClock.defaultInstance.setScale(val);
  }

  static isPaused(): boolean {
    return GameClock.defaultInstance.isPaused();
  }

  static getScale(): ClockScale {
    return GameClock.defaultInstance.getScale();
  }

  static effectiveScale(): number {
    return GameClock.defaultInstance.effectiveScale();
  }

  static now(): number {
    return GameClock.defaultInstance.now();
  }

  static canControl(): boolean {
    return GameClock.defaultInstance.canControl();
  }

  static getSnapshot(): GameClockSnapshot {
    return GameClock.defaultInstance.getSnapshot();
  }

  static setPaused(paused: boolean): boolean {
    return GameClock.defaultInstance.setPaused(paused);
  }

  static togglePaused(): boolean {
    return GameClock.defaultInstance.togglePaused();
  }

  static setScale(scale: ClockScale): boolean {
    return GameClock.defaultInstance.setScale(scale);
  }

  static attachRoom(room: ClockRoomDelegate | null): void {
    if (room) GameClock.defaultInstance.attachRoom(room);
    else GameClock.defaultInstance.detachRoom();
  }

  static detachRoom(): void {
    GameClock.defaultInstance.detachRoom();
  }

  static setFromRemote(paused: boolean, scale: ClockScale): void {
    GameClock.defaultInstance.setFromRemote(paused, scale);
  }

  static tick(dt: number): void {
    GameClock.defaultInstance.tick(dt);
  }

  static subscribe(fn: () => void): () => void {
    return GameClock.defaultInstance.subscribe(fn);
  }

  static reset(): void {
    GameClock.defaultInstance.reset();
  }

  private static hourSkipper: ((hour: number) => void) | null = null;
  private static solSkipper: (() => void) | null = null;

  static setTimeSkipper(
    hourSkipper?: ((hour: number) => void) | null,
    solSkipper?: (() => void) | null,
  ): void {
    GameClock.hourSkipper = hourSkipper ?? null;
    GameClock.solSkipper = solSkipper ?? null;
  }

  static skipToHour(hour: number): void {
    GameClock.hourSkipper?.(hour);
  }

  static skipSol(): void {
    GameClock.solSkipper?.();
  }

  // --- Estado de cada instância ---
  paused = false;
  scale: ClockScale = 1;
  private simTime = 0;
  private room: ClockRoomDelegate | null = null;
  private readonly listeners = new Set<() => void>();

  private cachedSnapshot: GameClockSnapshot = {
    paused: false,
    scale: 1,
    effectiveScale: 1,
    simTime: 0,
    canControl: true,
    isCoordinator: true,
    playerCount: 1,
  };

  private updateSnapshot(): void {
    const isCoord = this.room
      ? typeof this.room.isCoordinator === 'function'
        ? this.room.isCoordinator()
        : Boolean(this.room.isCoordinator)
      : true;
    this.cachedSnapshot = {
      paused: this.paused,
      scale: this.scale,
      effectiveScale: this.effectiveScale(),
      simTime: this.simTime,
      canControl: this.canControl(),
      isCoordinator: isCoord,
      playerCount: this.room ? this.room.playerCount() : 1,
    };
  }

  private notify(): void {
    this.updateSnapshot();
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error('[GameClock] Erro no listener:', err);
      }
    }
  }

  attachRoom(room: ClockRoomDelegate | null): void {
    this.room = room;
    this.notify();
  }

  detachRoom(): void {
    this.room = null;
    this.notify();
  }

  canControl(): boolean {
    if (!this.room) return true;
    const count = this.room.playerCount();
    if (count <= 1) return true;
    const c = this.room.isCoordinator;
    return typeof c === 'function' ? c() : Boolean(c);
  }

  isPaused(): boolean {
    return this.paused;
  }

  getScale(): ClockScale {
    return this.scale;
  }

  effectiveScale(): number {
    return this.paused ? 0 : this.scale;
  }

  now(): number {
    return this.simTime;
  }

  getSnapshot(): GameClockSnapshot {
    return this.cachedSnapshot;
  }

  setPaused(paused: boolean): boolean {
    if (!this.canControl()) {
      console.warn('[GameClock] Apenas o coordenador da sala pode pausar o jogo.');
      return false;
    }
    if (this.paused !== paused) {
      this.paused = paused;
      this.notify();
      this.room?.sendTime(this.paused, this.scale);
    }
    return true;
  }

  togglePaused(): boolean {
    return this.setPaused(!this.paused);
  }

  setScale(scale: ClockScale): boolean {
    let validScale: ClockScale = scale;
    if (validScale !== 1 && validScale !== 2 && validScale !== 3) {
      validScale = 1;
    }
    if (!this.canControl()) {
      console.warn('[GameClock] Apenas o coordenador da sala pode alterar a velocidade.');
      return false;
    }
    if (this.scale !== validScale) {
      this.scale = validScale;
      this.notify();
      this.room?.sendTime(this.paused, this.scale);
    }
    return true;
  }

  setFromRemote(paused: boolean, scale: ClockScale): void {
    let validScale: ClockScale = scale;
    if (validScale !== 1 && validScale !== 2 && validScale !== 3) {
      validScale = 1;
    }
    const changed = this.paused !== paused || this.scale !== validScale;
    this.paused = paused;
    this.scale = validScale;
    if (changed) {
      this.notify();
    }
  }

  tick(dt: number): void {
    this.simTime += dt * this.effectiveScale();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  reset(): void {
    this.paused = false;
    this.scale = 1;
    this.simTime = 0;
    this.room = null;
    this.notify();
  }
}

/**
 * Hook React reativo para ler e reagir ao estado do relógio de jogo global.
 */
export function useGameClock(): GameClockSnapshot {
  return useSyncExternalStore(
    (cb) => GameClock.subscribe(cb),
    () => GameClock.getSnapshot(),
  );
}

/** Instância singleton compartilhada do relógio do jogo */
export const gameClock = GameClock.defaultInstance;
