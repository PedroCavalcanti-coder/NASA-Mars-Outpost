import { z } from 'zod';
import type { MissionState, LogEntry } from './campaign';
import type { IntegrityState, RepairIntent } from './integrity';

export const GAMEPLAY_VERSION = 1;
export const GAME_STEP_MS = 100;
export const GAME_PUBLISH_MS = 500;
export const WORLD_SAVE_MAX_BYTES = 256 * 1024;
export type PauseReason = 'manual' | 'event' | 'repair' | 'loading' | 'empty' | 'ended';
export type ActivityKind = 'station' | 'drill' | 'soil' | 'solar' | 'filter' | 'greenhouse' | 'upload' | 'ducts';
export interface GameplayPlayer {
  id: string; name: string; ready: boolean; tank: number; exposure: number;
  inside: boolean; driving: boolean; rescued: number; rescueUntil: number;
  blocked: boolean; cold: boolean; carrying: number;
}
export interface Challenge {
  rolls: number[]; target: string; debris: number[]; files: number[];
  soil: number[]; blocks: number[];
}
export interface ActivityAttempt {
  id: string; player: string; kind: ActivityKind; target: string; sol: number;
  startedAt: number; elapsed: number; expiresAt: number; seq: number;
  challenge: Challenge; marks: boolean[]; lastAction: number;
  drill: { depth: number; heat: number; jammed: boolean }; holding: boolean;
  removed: number[]; coverage: number[]; water: number; moisture: number;
  samples: number[]; file: number; transmitted: number; batch: number;
  quality: number | null; participants: string[];
  /** resultado relatado pelo minigame original (nota 0..1, água usada, pesquisa da sondagem) */
  reported?: { quality: number; water: number; research: number };
}
export interface OfficialEvent {
  eid: string; id: string; sol: number; mode: 'solo' | 'decider' | 'vote';
  deciderId: string | null; voters: { id: string; name: string }[];
  votes: Record<string, number>; remainingMs: number;
  /** explosão solar real (arquivo do DONKI) ligada a este evento, quando é de radiação */
  flare?: { classType: string; peak: string; region: number; note: string };
  result: { choice: number; outcome: EventResult } | null;
}
export interface EventResult {
  tone: 'good' | 'bad' | 'info'; text: string;
  deltas?: Partial<Record<'energy' | 'supplies' | 'oxygen' | 'armor' | 'research', number>>;
}
export interface GameplayState {
  version: typeof GAMEPLAY_VERSION; generation: string; revision: number;
  elapsedMs: number; interactionMs: number; scale: 1 | 2 | 3; pauses: PauseReason[];
  started: boolean; mission: MissionState; integrity: IntegrityState;
  solar: number[]; crops: number[]; growth: number[];
  care: { crops: number[]; filter: number; needsCare: boolean[] };
  board: { sol: number; ids: string[]; done: string[]; garden: number; players: number; /** painéis limpos hoje (a missão pede 2) */ solar?: number[]; /** canteiros regados hoje (a missão da horta pede todos os plantados) */ watered?: number[] };
  quotas: { moxie: number; water: number; bench: number }; rocks: number[];
  storm: number; stormLeft: number; wind: number;
  eventQueue: { eid: string; id: string; sol: number }[];
  event: OfficialEvent | null; eventSols: number[];
  pending: { id: string; remainingMs: number; research: number }[];
  players: Record<string, GameplayPlayer>; attempts: Record<string, ActivityAttempt>;
  /**
   * Crítico do dia (30% dos Sóis): numa hora sorteada a base sofre um rombo na blindagem ou os
   * dutos de ar entopem, e a tripulação precisa consertar rápido.
   */
  critical?: CriticalState | null;
  /** dose de radiação acumulada pela tripulação (mSv), com base nas medições do RAD/Curiosity */
  dose?: number;
  /** maior faixa de alerta de dose já avisada (a cada 25 mSv) */
  doseAlert?: number;
  /** fração de ponto de ânimo ainda não cobrada pela radiação */
  moraleDrain?: number;
  /**
   * Radiação ALTA lá fora (explosão solar): ninguém sai da base até `until` (tempo de jogo, ms).
   * Quem está fora recebe dose rápido. Passou o prazo, é seguro sair de novo.
   */
  radiation?: { until: number; startedAt: number; source: string } | null;
  /** dificuldade do mundo (ausente = normal) */
  difficulty?: import('./difficulty').Difficulty;
  /** expedição do rover em andamento (null/ausente = nenhuma) */
  expedition?: ExpeditionState | null;
}
/**
 * Expedição com o rover: os astronautas do carro vão para um mapa coberto de neblina, acham 3
 * pedras com o radar, levam cada uma ao rover e voltam. Estourou o tempo: voltam sem perder nada.
 */
export interface ExpeditionState {
  id: string;
  /** tempo de interação (ms) em que começou e em que acaba */
  startedAt: number;
  deadline: number;
  /** quem foi (motorista e passageiro do rover) */
  members: string[];
  /** alvos: pedras (pegar e levar ao rover) e poços de escavação (cavar no lugar conta como coletado) */
  rocks: { x: number; z: number; by: string | null; loaded: boolean; kind?: 'rock' | 'pit' }[];
  /** onde o rover chegou e de onde saiu (para a volta) */
  start: { x: number; z: number; h: number };
  home: { x: number; z: number; h: number };
}
export interface CriticalState {
  kind: 'breach' | 'ducts';
  sol: number;
  /** começa neste tempo de jogo (ms) */
  at: number;
  /** já começou (alerta na tela) */
  active: boolean;
  /** prazo (tempo de jogo, ms): depois disso o estrago piora */
  deadline: number;
  /** o prazo passou e o estrago extra já foi aplicado */
  overdue: boolean;
}
export interface GameplaySnapshot { version: number; serverNow: number; state: GameplayState }
export interface GameplayUpdate {
  version: number; generation: string; previousRevision: number; revision: number;
  serverNow: number; state: Omit<GameplayState, 'mission'> & { mission: Omit<MissionState, 'log'> };
  entries: LogEntry[];
}
const short = z.string().min(1).max(96);
const index = z.number().int().min(0).max(255);
const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
export const activityActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mark'), round: index }).strict(),
  z.object({ type: z.literal('drill'), holding: z.boolean() }).strict(),
  z.object({ type: z.literal('collect') }).strict(),
  z.object({ type: z.literal('sample'), index }).strict(),
  z.object({ type: z.literal('brush'), points: z.array(point).min(1).max(32) }).strict(),
  z.object({ type: z.literal('remove'), ids: z.array(index).min(1).max(16) }).strict(),
  z.object({ type: z.literal('water'), holding: z.boolean() }).strict(),
  z.object({ type: z.literal('transmit'), file: index, holding: z.boolean() }).strict(),
  z.object({
    type: z.literal('result'),
    quality: z.number().min(0).max(1),
    water: z.number().min(0).max(20).optional(),
    research: z.number().min(0).max(40).optional(),
  }).strict(),
]);
export type ActivityAction = z.infer<typeof activityActionSchema>;
export const gameCommandSchema = z.object({
  version: z.literal(GAMEPLAY_VERSION), operationId: short, generation: short,
  payload: z.discriminatedUnion('type', [
    z.object({ type: z.literal('ready') }).strict(),
    z.object({ type: z.literal('time'), paused: z.boolean(), scale: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict(),
    z.object({ type: z.literal('start'), kind: z.enum(['station','drill','soil','solar','filter','greenhouse','upload','ducts']), target: short }).strict(),
    z.object({ type: z.literal('actions'), attempt: short, seq: z.number().int().min(1).max(100000), actions: z.array(activityActionSchema).min(1).max(32) }).strict(),
    z.object({ type: z.literal('finish'), attempt: short }).strict(),
    z.object({ type: z.literal('cancel'), attempt: short }).strict(),
    z.object({ type: z.literal('interact'), kind: z.enum(['plant','harvest','rock','moxie','water','bench','deliver']), target: short }).strict(),
    z.object({ type: z.literal('event:open'), eid: short }).strict(),
    z.object({ type: z.literal('event:choose'), eid: short, choice: index }).strict(),
    z.object({ type: z.literal('action'), action: z.enum(['research','expedition']) }).strict(),
    // expedição com o rover: partir, pegar uma pedra, colocá-la no carro
    z.object({ type: z.literal('expedition'), op: z.enum(['start','pick','load','abort','dig']), rock: index.optional() }).strict(),
    // ferramentas de teste (o servidor só aceita fora de produção)
    z.object({ type: z.literal('dev'), action: z.enum(['complete','event','catastrophe','storm','refill','next_sol','critical','radiation']), id: short.optional() }).strict(),
  ]),
}).strict();
export type GameCommand = z.infer<typeof gameCommandSchema>;
export type GamePayload = GameCommand['payload'];
export type GameErrorCode = 'INVALID_COMMAND' | 'STALE_GENERATION' | 'NOT_READY' | 'PAUSED' | 'ENDED' | 'FORBIDDEN' | 'TOO_FAR' | 'UNAVAILABLE' | 'BUSY' | 'INSUFFICIENT_RESOURCES' | 'INVALID_SEQUENCE' | 'EXPIRED' | 'RATE_LIMITED' | 'OFFLINE';
/** Mensagem mostrada ao jogador para cada recusa do servidor. */
export const GAME_ERROR_MESSAGES: Record<GameErrorCode, string> = {
  INVALID_COMMAND: 'Ação inválida.',
  STALE_GENERATION: 'A missão foi reiniciada. Sincronizando com a sala…',
  NOT_READY: 'Seu astronauta ainda está chegando à base.',
  PAUSED: 'O jogo está pausado.',
  ENDED: 'A missão já terminou.',
  FORBIDDEN: 'Só o coordenador da sala pode fazer isso.',
  TOO_FAR: 'Chegue mais perto para fazer isso.',
  UNAVAILABLE: 'Isso não está disponível agora.',
  BUSY: 'Alguém da tripulação já está cuidando disso.',
  INSUFFICIENT_RESOURCES: 'Recursos insuficientes na base.',
  INVALID_SEQUENCE: 'Ação fora de ordem. Tente de novo.',
  EXPIRED: 'O tempo da atividade acabou.',
  RATE_LIMITED: 'Calma! Muitas ações ao mesmo tempo.',
  OFFLINE: 'Conexão indisponível.',
};
export type GameConfirmation = { ok: true; operationId: string; generation: string; revision: number; attempt?: ActivityAttempt } | { ok: false; operationId: string; generation: string; revision: number; code: GameErrorCode; error: string };
export interface GameplayContext {
  x: number; z: number; inside: boolean; sheltered: boolean; driving: boolean;
  ready: boolean;
}
/** Adapter implemented by the existing movement owner; gameplay never integrates physics. */
export interface GameplayMovement {
  context(id: string): GameplayContext | undefined;
  near(id: string, target: string, distance: number): boolean;
  restrict(id: string, blocked: boolean, cold: boolean, slow?: boolean): void;
  /** radiação alta: ninguém pode sair da base (o servidor segura quem está dentro) */
  lockExit?(on: boolean): void;
  /** expedição: usa o campo aberto (sem as estruturas da base) em vez da malha da base */
  fieldMode?(on: boolean): void;
  /** quem está no rover (a expedição leva os dois) */
  occupants?(): { driver: string | null; rider: string | null };
  /** posição e direção atuais do rover */
  roverPose?(): { x: number; z: number; h: number };
  /** teleporta o rover (com quem está dentro) ou um astronauta */
  teleport?(id: string, pose: { x: number; z: number; h: number }): void;
  /** ponto livre mais próximo, fora da base (`null` se não houver) */
  spot?(x: number, z: number, profile: 'foot' | 'vehicle'): { x: number; z: number } | null;
  rescue(id: string): void;
}
export interface WorldSaveV3 {
  v: 3; simulation: GameplayState;
  elapsedMs: number; solar: number[]; crops: number[]; integrity: IntegrityState;
  vehicle?: { x: number; z: number; h: number };
  care: GameplayState['care']; board: GameplayState['board'];
  timeScale: 1 | 2 | 3; paused: boolean; mission: MissionState;
}
