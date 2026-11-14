import type { ClientToServerEvents, ServerToClientEvents } from '@mars/shared';
import { io, type Socket } from 'socket.io-client';
import { api } from './api';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Vazio = mesma origem. Em produção com domínios separados, defina VITE_SOCKET_URL. */
const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? '';

/**
 * Conexão WebSocket autenticada. A cada (re)conexão pede um ingresso novo de 60 s,
 * então o socket nunca depende de token vencido nem de cookie entre domínios.
 */
export function connectSocket(): AppSocket {
  return io(SOCKET_URL, {
    transports: ['websocket'],
    withCredentials: true,
    auth: (cb) => {
      api<{ ticket: string }>('/auth/socket-ticket', { method: 'POST' })
        .then((r) => cb({ ticket: r.ticket }))
        .catch(() => cb({ ticket: '' }));
    },
  });
}
