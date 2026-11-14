import { EventEmitter } from 'node:events';
import type { DirectMessage, FriendInfo } from '@mars/shared';

/**
 * Barramento interno: as rotas HTTP publicam, o Socket.IO escuta.
 * Assim a camada HTTP não depende do socket (e os testes não precisam dele).
 */
interface Events {
  /** Uma sessão foi encerrada (logout, revogação, refresh roubado). */
  'session:revoked': [sessionId: string];
  /** Todas as sessões do usuário (exceto uma) foram encerradas. */
  'user:sessions-revoked': [userId: string, exceptSessionId: string | null];
  'friend:request': [toUserId: string, friend: FriendInfo];
  'friend:accepted': [toUserId: string, friend: FriendInfo];
  'friend:removed': [toUserId: string, p: { friendshipId: string; userId: string }];
}

class Bus extends EventEmitter {
  publish<K extends keyof Events>(event: K, ...args: Events[K]) {
    this.emit(event, ...args);
  }
  subscribe<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void) {
    this.on(event, fn as (...a: unknown[]) => void);
  }
}

export const bus = new Bus();
export type { DirectMessage };
