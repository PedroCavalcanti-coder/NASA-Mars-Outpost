import {
  type DuoGestureId,
  type GameMotion,
  GESTURE_INVITE_COOLDOWN_MS,
  GESTURE_INVITE_TTL_MS,
  GESTURE_MAX_DISTANCE,
  type GestureStart,
  isDuoGestureId,
} from '@mars/shared';

/** O que o broker precisa saber de cada jogador da sala. */
export interface GesturePlayer {
  motion?: GameMotion;
}

export type GestureLookup = (id: string) => GesturePlayer | undefined;

export type InviteResult =
  | { ok: true; targetId: string; gesture: DuoGestureId }
  | { ok: false; reason: string };

export type AcceptResult = { ok: true; start: GestureStart } | { ok: false; reason: string };

interface PendingInvite {
  gesture: DuoGestureId;
  expiresAt: number;
}

function distance(a: GameMotion, b: GameMotion) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Convites de gestos em dupla de UMA sala. Tudo que chega da rede é validado aqui:
 * gesto da lista, alvo dentro da sala, os dois a pé e a ≤ 2,5 m, ~1 convite a cada 3 s.
 */
export class GestureBroker {
  /** convites pendentes: alvo → (quem convidou → convite) */
  private readonly pending = new Map<string, Map<string, PendingInvite>>();
  private readonly lastInvite = new Map<string, number>();

  invite(
    fromId: string,
    rawTarget: unknown,
    rawGesture: unknown,
    lookup: GestureLookup,
    now: number,
  ): InviteResult {
    if (!isDuoGestureId(rawGesture)) return { ok: false, reason: 'Gesto inválido.' };
    if (typeof rawTarget !== 'string' || rawTarget === fromId) {
      return { ok: false, reason: 'Escolha outro astronauta.' };
    }
    const from = lookup(fromId);
    const target = lookup(rawTarget);
    if (!from || !target) return { ok: false, reason: 'Esse astronauta não está na sala.' };
    if (now - (this.lastInvite.get(fromId) ?? -Infinity) < GESTURE_INVITE_COOLDOWN_MS) {
      return { ok: false, reason: 'Aguarde um instante para convidar de novo.' };
    }
    const ok = this.checkReady(from.motion, target.motion);
    if (!ok.ok) return ok;
    this.lastInvite.set(fromId, now);
    const inbox = this.pending.get(rawTarget) ?? new Map<string, PendingInvite>();
    this.pending.set(rawTarget, inbox);
    inbox.set(fromId, { gesture: rawGesture, expiresAt: now + GESTURE_INVITE_TTL_MS });
    return { ok: true, targetId: rawTarget, gesture: rawGesture };
  }

  accept(accepterId: string, rawFrom: unknown, lookup: GestureLookup, now: number): AcceptResult {
    if (typeof rawFrom !== 'string' || rawFrom === accepterId) {
      return { ok: false, reason: 'Convite inválido.' };
    }
    const inbox = this.pending.get(accepterId);
    const invite = inbox?.get(rawFrom);
    inbox?.delete(rawFrom);
    if (!invite || invite.expiresAt < now) return { ok: false, reason: 'O convite expirou.' };
    const from = lookup(rawFrom);
    const me = lookup(accepterId);
    if (!from || !me) return { ok: false, reason: 'Esse astronauta saiu da sala.' };
    const ok = this.checkReady(from.motion, me.motion);
    if (!ok.ok) return ok;
    return { ok: true, start: { a: rawFrom, b: accepterId, gesture: invite.gesture, at: now } };
  }

  /** Limpa tudo que envolve um jogador que saiu. */
  remove(id: string) {
    this.pending.delete(id);
    this.lastInvite.delete(id);
    for (const inbox of this.pending.values()) inbox.delete(id);
  }

  private checkReady(a?: GameMotion, b?: GameMotion): { ok: true } | { ok: false; reason: string } {
    if (!a || !b) return { ok: false, reason: 'Aguarde os astronautas se posicionarem.' };
    if (a.m === 'drive' || b.m === 'drive') {
      return { ok: false, reason: 'Gestos em dupla só valem fora do rover.' };
    }
    if (distance(a, b) > GESTURE_MAX_DISTANCE) {
      return { ok: false, reason: 'Chegue mais perto do astronauta (até 2,5 m).' };
    }
    return { ok: true };
  }
}
