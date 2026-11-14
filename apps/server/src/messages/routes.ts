import { MESSAGE_PAGE_SIZE, messageHistorySchema } from '@mars/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { me, requireAuth } from '../auth/plugin';
import { areFriends } from '../friends/service';
import { HttpError, parse } from '../http';
import { history, markRead, unreadCounts } from './service';

const idParam = z.object({ userId: z.uuid() });

export async function messageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /** Mensagens não lidas por amigo: `{ [userId]: n }`. */
  app.get('/api/messages/unread', async (req) => unreadCounts(me(req).user.id));

  /** Histórico da conversa com um amigo (mais antigas primeiro). */
  app.get<{ Params: { userId: string } }>('/api/messages/:userId', async (req) => {
    const { userId } = parse(idParam, req.params);
    const { before, limit } = parse(messageHistorySchema, req.query);
    const self = me(req).user;
    if (!(await areFriends(self.id, userId))) throw new HttpError(403, 'Vocês não são amigos');
    return history(self.id, userId, limit ?? MESSAGE_PAGE_SIZE, before);
  });

  app.post<{ Params: { userId: string } }>('/api/messages/:userId/read', async (req) => {
    const { userId } = parse(idParam, req.params);
    const self = me(req).user;
    if (!(await areFriends(self.id, userId))) throw new HttpError(403, 'Vocês não são amigos');
    return { read: await markRead(self.id, userId) };
  });
}
