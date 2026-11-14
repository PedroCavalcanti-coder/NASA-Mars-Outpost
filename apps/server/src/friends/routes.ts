import {
  friendRequestSchema,
  MAX_FRIENDS,
  type Relation,
  USER_SEARCH_LIMIT,
  type UserSearchResult,
  userSearchSchema,
} from '@mars/shared';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { me, requireAuth } from '../auth/plugin';
import { db } from '../db/client';
import { friendships, pairKey, users } from '../db/schema';
import { bus } from '../events';
import { HttpError, parse, uniqueViolation } from '../http';
import { toUserCard } from '../users';
import { findFriendship, listFriends, toFriendInfo } from './service';

export async function friendRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/friends', async (req) => listFriends(me(req).user.id));

  /** Busca por apelido (prefixo). Nunca expõe e-mail. */
  app.get(
    '/api/users/search',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req) => {
      const { q } = parse(userSearchSchema, req.query);
      const uid = me(req).user.id;
      const term = q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
      const found = await db
        .select()
        .from(users)
        .where(and(ne(users.id, uid), sql`${users.username} like ${`${term}%`} escape '\\'`))
        .orderBy(users.username)
        .limit(USER_SEARCH_LIMIT);
      if (!found.length) return [];
      const rels = await db
        .select()
        .from(friendships)
        .where(or(eq(friendships.requesterId, uid), eq(friendships.addresseeId, uid)));
      const relation = (otherId: string): Relation => {
        const f = rels.find((r) => r.pairKey === pairKey(uid, otherId));
        if (!f) return 'none';
        if (f.status === 'accepted') return 'friend';
        return f.requesterId === uid ? 'outgoing' : 'incoming';
      };
      return found.map<UserSearchResult>((u) => ({ ...toUserCard(u), relation: relation(u.id) }));
    },
  );

  /** Envia pedido pelo apelido. Se a outra pessoa já tinha pedido, vira amizade direto. */
  app.post(
    '/api/friends',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req) => {
      const { username } = parse(friendRequestSchema, req.body);
      const self = me(req).user;
      const [target] = await db.select().from(users).where(eq(users.username, username));
      if (!target) throw new HttpError(404, 'Nenhum jogador com esse apelido');
      if (target.id === self.id) throw new HttpError(400, 'Você não pode adicionar a si mesmo');

      const existing = await findFriendship(self.id, target.id);
      if (existing?.status === 'accepted') throw new HttpError(409, 'Vocês já são amigos');
      if (existing && existing.requesterId === self.id)
        throw new HttpError(409, 'Pedido já enviado');

      if (existing) {
        // a outra pessoa já tinha pedido: aceitar
        const [f] = await db
          .update(friendships)
          .set({ status: 'accepted', respondedAt: sql`now()` })
          .where(and(eq(friendships.id, existing.id), eq(friendships.status, 'pending')))
          .returning();
        if (f) bus.publish('friend:accepted', target.id, toFriendInfo(f, self));
        return { status: 'accepted' as const, id: existing.id };
      }

      const count = (await listFriends(self.id)).friends.length;
      if (count >= MAX_FRIENDS) throw new HttpError(409, 'Limite de amigos atingido');
      try {
        const [f] = await db
          .insert(friendships)
          .values({
            requesterId: self.id,
            addresseeId: target.id,
            pairKey: pairKey(self.id, target.id),
          })
          .returning();
        bus.publish('friend:request', target.id, toFriendInfo(f!, self));
        return { status: 'pending' as const, id: f!.id };
      } catch (err) {
        if (uniqueViolation(err)) throw new HttpError(409, 'Pedido já enviado'); // corrida entre dois pedidos
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string } }>('/api/friends/:id/accept', async (req) => {
    const self = me(req).user;
    const [f] = await db
      .update(friendships)
      .set({ status: 'accepted', respondedAt: sql`now()` })
      .where(
        and(
          eq(friendships.id, req.params.id),
          eq(friendships.addresseeId, self.id),
          eq(friendships.status, 'pending'),
        ),
      )
      .returning();
    if (!f) throw new HttpError(404, 'Pedido não encontrado');
    bus.publish('friend:accepted', f.requesterId, toFriendInfo(f, self));
    return { ok: true };
  });

  /** Recusar pedido recebido, cancelar pedido enviado ou desfazer amizade. */
  app.delete<{ Params: { id: string } }>('/api/friends/:id', async (req) => {
    const self = me(req).user;
    const [f] = await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.id, req.params.id),
          or(eq(friendships.requesterId, self.id), eq(friendships.addresseeId, self.id)),
        ),
      )
      .returning();
    if (!f) throw new HttpError(404, 'Não encontrado');
    const otherId = f.requesterId === self.id ? f.addresseeId : f.requesterId;
    bus.publish('friend:removed', otherId, { friendshipId: f.id, userId: self.id });
    return { ok: true };
  });
}
