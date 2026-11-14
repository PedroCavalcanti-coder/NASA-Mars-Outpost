import type { Server as HttpServer } from 'node:http';
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  sendMessageSchema,
} from '@mars/shared';
import { Server } from 'socket.io';
import { loadAuth } from '../auth/sessions';
import { config } from '../config';
import { bus } from '../events';
import { areFriends, friendIds } from '../friends/service';
import { markRead, saveMessage } from '../messages/service';
import { verifyToken } from '../security/tokens';
import { addPresence, isOnline, removePresence } from './presence';

interface SocketData {
  userId: string;
  sessionId: string;
  /** janela deslizante simples: no máximo 10 mensagens a cada 10 s por conexão */
  sent: number[];
}

export type IO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const userRoom = (id: string) => `user:${id}`;
const sessionRoom = (id: string) => `session:${id}`;

export function createSocketServer(http: HttpServer): IO {
  const io: IO = new Server(http, {
    cors: { origin: config.webOrigins, credentials: true },
    serveClient: false,
    maxHttpBufferSize: 16 * 1024, // mensagens são curtas; corta payloads gigantes
  });

  /** Autentica no handshake com o ingresso de 60 s (POST /api/auth/socket-ticket). */
  io.use(async (socket, next) => {
    const ticket = (socket.handshake.auth as { ticket?: unknown } | undefined)?.ticket;
    const claims = await verifyToken(typeof ticket === 'string' ? ticket : undefined, 'socket');
    const auth = claims ? await loadAuth(claims) : null;
    if (!auth) return next(new Error('unauthorized'));
    socket.data.userId = auth.user.id;
    socket.data.sessionId = auth.sessionId;
    socket.data.sent = [];
    next();
  });

  io.on('connection', async (socket) => {
    const { userId, sessionId } = socket.data;
    // Os handlers entram ANTES de qualquer await: o cliente pode emitir logo após conectar.
    let closed = false;
    let present = false;

    socket.on('dm:send', async (raw, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const now = Date.now();
      socket.data.sent = socket.data.sent.filter((t) => now - t < 10_000);
      if (socket.data.sent.length >= 10)
        return reply({ ok: false, error: 'Calma! Envie mais devagar.' });
      const parsed = sendMessageSchema.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, error: 'Mensagem inválida' });
      const { to, text } = parsed.data;
      try {
        if (!(await areFriends(userId, to)))
          return reply({ ok: false, error: 'Vocês não são amigos' });
        socket.data.sent.push(now);
        const message = await saveMessage(userId, to, text);
        io.to(userRoom(to)).emit('dm:message', message);
        // outras abas/dispositivos do remetente também recebem
        socket.to(userRoom(userId)).emit('dm:message', message);
        reply({ ok: true, message });
      } catch (err) {
        console.error('[socket] dm:send', (err as Error).message);
        reply({ ok: false, error: 'Não foi possível enviar agora' });
      }
    });

    socket.on('dm:read', async (raw, ack) => {
      const from = (raw as { from?: unknown } | undefined)?.from;
      if (typeof from !== 'string') return;
      try {
        if ((await markRead(userId, from)) > 0) {
          io.to(userRoom(from)).emit('dm:read', { by: userId, at: new Date().toISOString() });
        }
        if (typeof ack === 'function') ack({ ok: true });
      } catch {
        if (typeof ack === 'function') ack({ ok: false, error: 'Falha ao marcar como lida' });
      }
    });

    socket.on('disconnect', async () => {
      closed = true;
      if (!present || !removePresence(userId, socket.id)) return;
      try {
        for (const f of await friendIds(userId)) {
          io.to(userRoom(f)).emit('presence:update', { userId, online: false });
        }
      } catch {
        /* sem banco agora: os amigos corrigem na próxima atualização */
      }
    });

    // Entra nas salas e anuncia a presença.
    await socket.join([userRoom(userId), sessionRoom(sessionId)]);
    const friends = await friendIds(userId);
    if (closed) return; // desconectou durante a preparação
    present = true;
    const becameOnline = addPresence(userId, socket.id);
    socket.emit('presence:list', friends.filter(isOnline));
    if (becameOnline) {
      for (const f of friends) io.to(userRoom(f)).emit('presence:update', { userId, online: true });
    }
  });

  // --- ponte com a camada HTTP ---
  bus.subscribe('friend:request', (to, f) => io.to(userRoom(to)).emit('friend:request', f));
  bus.subscribe('friend:accepted', (to, f) => io.to(userRoom(to)).emit('friend:accepted', f));
  bus.subscribe('friend:removed', (to, p) => io.to(userRoom(to)).emit('friend:removed', p));

  /** Avisa o cliente e só então fecha a conexão (senão o aviso pode se perder no caminho). */
  const kick = (s: {
    emit: (e: 'session:revoked') => unknown;
    disconnect: (close?: boolean) => unknown;
  }) => {
    s.emit('session:revoked');
    setTimeout(() => s.disconnect(true), 300).unref();
  };
  bus.subscribe('session:revoked', async (sid) => {
    for (const s of await io.in(sessionRoom(sid)).fetchSockets()) kick(s);
  });
  bus.subscribe('user:sessions-revoked', async (uid, except) => {
    for (const s of await io.in(userRoom(uid)).fetchSockets()) {
      if (s.data.sessionId !== except) kick(s);
    }
  });

  // Rede de segurança: sessões que expiraram sem passar por revogação explícita.
  const sweep = setInterval(async () => {
    try {
      const seen = new Map<string, boolean>();
      for (const s of await io.fetchSockets()) {
        const key = `${s.data.sessionId}:${s.data.userId}`;
        if (!seen.has(key)) {
          seen.set(key, !!(await loadAuth({ userId: s.data.userId, sessionId: s.data.sessionId })));
        }
        if (!seen.get(key)) {
          kick(s);
        }
      }
    } catch {
      /* tenta de novo no próximo ciclo */
    }
  }, 5 * 60_000);
  sweep.unref();
  io.engine.on('close', () => clearInterval(sweep));

  return io;
}
