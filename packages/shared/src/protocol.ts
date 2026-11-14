import type { DirectMessage, FriendInfo } from './types';

/** Eventos Socket.IO servidor -> cliente. */
export interface ServerToClientEvents {
  /** Um amigo conectou/desconectou. */
  'presence:update': (p: { userId: string; online: boolean }) => void;
  /** Lista inicial de amigos online (enviada ao conectar). */
  'presence:list': (onlineUserIds: string[]) => void;
  'friend:request': (f: FriendInfo) => void;
  'friend:accepted': (f: FriendInfo) => void;
  'friend:removed': (p: { friendshipId: string; userId: string }) => void;
  'dm:message': (m: DirectMessage) => void;
  'dm:read': (p: { by: string; at: string }) => void;
  /** A sessão foi encerrada (logout, senha trocada…): o cliente deve voltar ao login. */
  'session:revoked': () => void;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Eventos Socket.IO cliente -> servidor. */
export interface ClientToServerEvents {
  'dm:send': (
    p: { to: string; text: string },
    ack: (r: Ack<{ message: DirectMessage }>) => void,
  ) => void;
  'dm:read': (p: { from: string }, ack?: (r: Ack) => void) => void;
}
