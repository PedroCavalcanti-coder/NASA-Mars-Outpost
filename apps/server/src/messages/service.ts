import type { DirectMessage } from '@mars/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { directMessages, pairKey } from '../db/schema';

type Row = typeof directMessages.$inferSelect;

export const toMessage = (m: Row): DirectMessage => ({
  id: m.id,
  from: m.senderId,
  to: m.recipientId,
  text: m.text,
  createdAt: m.createdAt.toISOString(),
  readAt: m.readAt?.toISOString() ?? null,
});

export async function saveMessage(from: string, to: string, text: string) {
  const [row] = await db
    .insert(directMessages)
    .values({ senderId: from, recipientId: to, pairKey: pairKey(from, to), text })
    .returning();
  return toMessage(row!);
}

/** Histórico paginado (mais novas primeiro no banco; devolvido em ordem cronológica). */
export async function history(a: string, b: string, limit: number, before?: string) {
  const rows = await db
    .select()
    .from(directMessages)
    .where(
      and(
        eq(directMessages.pairKey, pairKey(a, b)),
        before ? sql`${directMessages.createdAt} < ${new Date(before)}` : undefined,
      ),
    )
    .orderBy(sql`${directMessages.createdAt} desc`)
    .limit(limit);
  return rows.reverse().map(toMessage);
}

/** Marca como lidas as mensagens que `from` enviou para `reader`. Devolve quantas mudaram. */
export async function markRead(reader: string, from: string) {
  const rows = await db
    .update(directMessages)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(directMessages.recipientId, reader),
        eq(directMessages.senderId, from),
        isNull(directMessages.readAt),
      ),
    )
    .returning({ id: directMessages.id });
  return rows.length;
}

/** Não lidas por remetente. */
export async function unreadCounts(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ from: directMessages.senderId, n: sql<number>`count(*)::int` })
    .from(directMessages)
    .where(and(eq(directMessages.recipientId, userId), isNull(directMessages.readAt)))
    .groupBy(directMessages.senderId);
  return Object.fromEntries(rows.map((r) => [r.from, r.n]));
}
