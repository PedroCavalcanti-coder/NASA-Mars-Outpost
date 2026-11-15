import type { Server as HttpServer } from 'node:http';
import type { ClientToServerEvents, ServerToClientEvents } from '@mars/shared';
import { Server } from 'socket.io';
import { originAllowed } from '../security/origin';

export type IO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  Record<string, never>
>;

/** Servidor Socket.IO. Não há login: o jogo usa o namespace `/game`, identificado pelo cookie do jogador. */
export function createSocketServer(http: HttpServer): IO {
  return new Server(http, {
    cors: { origin: (origin, cb) => cb(null, !origin || originAllowed(origin)), credentials: true },
    allowRequest: (req, cb) =>
      cb(null, !req.headers.origin || originAllowed(req.headers.origin, req.headers.host)),
    serveClient: false,
    maxHttpBufferSize: 16 * 1024,
  });
}
