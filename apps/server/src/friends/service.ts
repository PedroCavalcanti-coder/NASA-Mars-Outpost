import type { FriendInfo, FriendsResponse } from '@mars/shared';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/client';
import { friendships, pairKey, users } from '../db/schema';
import { isOnline } from '../realtime/presence';
import { toUserCard } from '../users';

type Friendship = typeof friendships.$inferSelect;
type UserRow = typeof users.$inferSelect;

export const toFriendInfo = (f: Friendship, other: UserRow): FriendInfo => ({
  id: f.id,
  user: toUserCard(other),
  since: (f.respondedAt ?? f.createdAt).toISOString(),
  online: isOnline(other.id),
});

export async function findFriendship(a: string, b: string): Promise<Friendship | undefined> {
  const [row] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.pairKey, pairKey(a, b)));
  return row;
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  return (await findFriendship(a, b))?.status === 'accepted';
}

/** Ids dos amigos confirmados (para presença e notificações). */
export async function friendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    );
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export async function listFriends(userId: string): Promise<FriendsResponse> {
  const rows = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
  const otherIds = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  const others = otherIds.length
    ? await db.select().from(users).where(inArray(users.id, otherIds))
    : [];
  const byId = new Map(others.map((u) => [u.id, u]));

  const out: FriendsResponse = { friends: [], incoming: [], outgoing: [] };
  for (const f of rows) {
    const other = byId.get(f.requesterId === userId ? f.addresseeId : f.requesterId);
    if (!other) continue;
    const info = toFriendInfo(f, other);
    if (f.status === 'accepted') out.friends.push(info);
    else if (f.addresseeId === userId) out.incoming.push(info);
    else out.outgoing.push(info);
  }
  out.friends.sort((a, b) => a.user.name.localeCompare(b.user.name, 'pt-BR'));
  return out;
}
