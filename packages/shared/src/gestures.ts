import type { GAME_EMOTES } from './game';

/**
 * Reações e gestos do Astronauta v2. Cada item de `GAME_EMOTES` tem aqui o clipe do GLB
 * (`Assets/modelos/astronaut_v2.glb`) e a expressão do rosto LED (célula do atlas `rostos_led.png`).
 * A ordem é a mesma de `GAME_EMOTES` e não pode mudar: o servidor valida pelo índice.
 */
export interface EmoteAnimation {
  emoji: (typeof GAME_EMOTES)[number];
  clip: string;
  /** célula do atlas de rostos: 0 feliz, 1 empolgado, 2 neutro, 3 cansado, 4 preocupado, 5 dormindo, 6 surpreso, 7 piscada */
  expression: number;
  /** repete o clipe até passar `seconds` (dança) */
  loop?: boolean;
  /** duração para clipes em loop */
  seconds?: number;
  /** rótulo em pt-BR para a interface */
  label: string;
}

export const EMOTE_ANIMATIONS: readonly EmoteAnimation[] = [
  { emoji: '😀', clip: 'Emote_Silly', expression: 7, label: 'Careta' },
  { emoji: '😂', clip: 'Emote_Laugh', expression: 1, label: 'Risada' },
  { emoji: '👍', clip: 'Emote_ThumbsUp', expression: 7, label: 'Joinha' },
  { emoji: '👋', clip: 'Emote_Bye', expression: 0, label: 'Tchau' },
  { emoji: '❤️', clip: 'Emote_Heart', expression: 0, label: 'Coração' },
  { emoji: '😮', clip: 'Emote_Surprised', expression: 6, label: 'Surpresa' },
  { emoji: '🎉', clip: 'Emote_Celebrate', expression: 1, label: 'Comemorar' },
  { emoji: '🚀', clip: 'Emote_Rocket', expression: 1, label: 'Foguete' },
  { emoji: '👎', clip: 'Emote_ThumbsDown', expression: 4, label: 'Deslike' },
  { emoji: '👏', clip: 'Emote_Clap', expression: 1, label: 'Palmas' },
  { emoji: '👉', clip: 'Emote_Point', expression: 2, label: 'Apontar' },
  { emoji: '💃', clip: 'Emote_Dance', expression: 0, loop: true, seconds: 4, label: 'Dançar' },
];

/** Gestos em dupla: os dois jogadores tocam o mesmo clipe, de frente um para o outro. */
export const DUO_GESTURE_IDS = ['high_five', 'handshake', 'fist_bump', 'hug'] as const;
export type DuoGestureId = (typeof DUO_GESTURE_IDS)[number];

export interface DuoGesture {
  clip: string;
  expression: number;
  label: string;
  emoji: string;
  /** onde o parceiro fica, no espaço de quem convidou: frente e lado direito (metros do modelo; multiplique pela escala) */
  front: number;
  side: number;
}

export const DUO_GESTURES: Record<DuoGestureId, DuoGesture> = {
  high_five: {
    clip: 'Duo_HighFive',
    expression: 1,
    label: 'Toca aqui',
    emoji: '🙌',
    front: 0.98,
    side: 0.78,
  },
  handshake: {
    clip: 'Duo_Handshake',
    expression: 0,
    label: 'Aperto de mão',
    emoji: '🤝',
    front: 0.92,
    side: 0.78,
  },
  fist_bump: {
    clip: 'Duo_FistBump',
    expression: 7,
    label: 'Soquinho',
    emoji: '👊',
    front: 1.0,
    side: 0.78,
  },
  hug: { clip: 'Duo_Hug', expression: 0, label: 'Abraço', emoji: '🫂', front: 0.6, side: 0.36 },
};

export function isDuoGestureId(v: unknown): v is DuoGestureId {
  return typeof v === 'string' && (DUO_GESTURE_IDS as readonly string[]).includes(v);
}

/** Distância máxima (unidades do mundo) entre os dois jogadores para convidar/aceitar. */
export const GESTURE_MAX_DISTANCE = 2.5;
/** Intervalo mínimo entre convites do mesmo jogador (ms). */
export const GESTURE_INVITE_COOLDOWN_MS = 3000;
/** Tempo que o convite fica valendo (ms). */
export const GESTURE_INVITE_TTL_MS = 5000;
/** Escala do modelo no jogo: as medidas dos gestos (em metros do modelo) viram unidades do mundo. */
export const ASTRONAUT_MODEL_SCALE = 0.75;

/** Mensagem do servidor para os dois jogadores: `a` convidou, `b` aceitou. */
export interface GestureStart {
  /** Canonical map-space anchors selected by the movement authority. */
  poses?: { a: { x: number; z: number; h: number }; b: { x: number; z: number; h: number } };
  a: string;
  b: string;
  gesture: DuoGestureId;
  /** hora do servidor (ms) em que o gesto começou */
  at: number;
}

/**
 * Onde `b` fica, em coordenadas do mundo, dado `a` em (ax, az) olhando para `heading`
 * (a frente é (sin h, cos h); a lateral positiva é a direita de `a`).
 */
export function duoPartnerPosition(
  gesture: DuoGestureId,
  ax: number,
  az: number,
  heading: number,
): { x: number; z: number } {
  const g = DUO_GESTURES[gesture];
  const f = g.front * ASTRONAUT_MODEL_SCALE;
  const s = g.side * ASTRONAUT_MODEL_SCALE;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  // direita de quem olha para (fx, fz), com y para cima (conferido no modelo: as mãos `_L` se encontram)
  const rx = -fz;
  const rz = fx;
  return { x: ax + fx * f + rx * s, z: az + fz * f + rz * s };
}
