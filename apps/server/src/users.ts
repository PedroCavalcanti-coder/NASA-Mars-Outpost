import type { PublicUser, UserCard } from '@mars/shared';
import type { users } from './db/schema';

type UserRow = typeof users.$inferSelect;

/** O próprio usuário vê o e-mail; os demais só veem nome e apelido. */
export const toPublicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  createdAt: u.createdAt.toISOString(),
});

export const toUserCard = (u: Pick<UserRow, 'id' | 'name' | 'username'>): UserCard => ({
  id: u.id,
  name: u.name,
  username: u.username,
});

/** Apelidos que não podem ser registrados (evitam se passar por equipe/instituição). */
export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrador',
  'root',
  'suporte',
  'support',
  'moderador',
  'mod',
  'nasa',
  'esa',
  'spacex',
  'marsoutpost',
  'mars_outpost',
  'sistema',
  'system',
  'api',
  'null',
  'undefined',
]);
