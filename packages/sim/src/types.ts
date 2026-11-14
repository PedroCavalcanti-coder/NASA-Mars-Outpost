/** Tipos do estado da missão. Tudo é serializável (JSON) para poder ir ao servidor depois. */

export type ResourceId = 'energy' | 'supplies' | 'materials' | 'oxygen';

export interface Resource {
  value: number;
  max: number;
}

export type Resources = Record<ResourceId, Resource>;

export type FacilityId = 'solar' | 'greenhouse' | 'lab';

/**
 * Crises derivadas dos recursos zerados:
 * - `blackout` (energia 0): sistemas parados, sem pesquisa nem expedições, dados se perdem.
 * - `famine` (mantimentos 0): moral despenca, expedições suspensas, dados se perdem.
 * - `shortage` (materiais 0): nada se constrói nem se repara; avarias custam caro.
 */
export type Crisis = 'blackout' | 'famine' | 'shortage';

export type MissionStatus = 'playing' | 'won' | 'lost';
export type LossReason = 'morale' | 'deadline';

export type ActionId =
  | 'research'
  | 'expedition'
  | 'mine'
  | 'maintain'
  | 'build_solar'
  | 'build_greenhouse'
  | 'build_lab';

export type Command =
  | { type: 'action'; action: ActionId }
  /**
   * `realtime`: o sol terminou pelo relógio do mundo 3D. Energia (bateria) e poeira dos painéis
   * já são simuladas em tempo real, então o fim do sol não as recalcula.
   */
  | { type: 'end_sol'; realtime?: boolean }
  /** recompensa/custo vindo de uma tarefa do mundo (minigame, colheita, sondagem) */
  | { type: 'reward'; tone: LogEntry['tone']; title: string; text: string; deltas: Deltas };

/** Variações exibidas na HUD (recursos, dados de pesquisa e moral). */
export type DeltaKey = ResourceId | 'research' | 'morale';
export type Deltas = Partial<Record<DeltaKey, number>>;

export interface LogEntry {
  id: number;
  sol: number;
  tone: 'good' | 'bad' | 'info';
  title: string;
  text: string;
  deltas: Deltas;
}

export interface MissionState {
  seed: number;
  /** estado interno do gerador aleatório (avança a cada sorteio) */
  rng: number;
  sol: number;
  actionsLeft: number;
  resources: Resources;
  facilities: Record<FacilityId, number>;
  /** eficiência dos painéis solares (poeira): 0..1 */
  solarEfficiency: number;
  /** moral da tripulação: 0..100; em 0 a base é evacuada */
  morale: number;
  /** dados científicos coletados: 0..RESEARCH_GOAL */
  research: number;
  status: MissionStatus;
  lossReason: LossReason | null;
  /** registro mais recente primeiro */
  log: LogEntry[];
  nextLogId: number;
}

export type CheckResult = { ok: true } | { ok: false; reason: string };
