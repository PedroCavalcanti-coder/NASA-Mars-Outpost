import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Tudo vive no schema `outpost`, separado do `public` onde ficam as tabelas do protótipo
 * anterior. Assim os dois convivem no mesmo banco Neon sem se tocar.
 */
export const outpost = pgSchema('outpost');

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

export const users = outpost.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** minúsculas; é como os amigos te encontram */
    username: text('username').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    failedLogins: integer('failed_logins').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    uniqueIndex('users_username_idx').on(t.username),
  ],
);

/** Uma linha por login em um dispositivo. O refresh token só existe aqui como HMAC. */
export const sessions = outpost.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshHash: text('refresh_hash').notNull(),
    /** hash do refresh anterior: reapresentá-lo fora da janela de tolerância = token roubado */
    prevRefreshHash: text('prev_refresh_hash'),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    userAgent: text('user_agent').notNull().default(''),
    ip: text('ip').notNull().default(''),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** Tokens de redefinição de senha (só o HMAC é guardado; uso único). */
export const passwordResets = outpost.table(
  'password_resets',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [index('password_resets_user_idx').on(t.userId)],
);

/** Pedido (pending) ou amizade (accepted). `pairKey` impede duplicar o par nos dois sentidos. */
export const friendships = outpost.table(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pairKey: text('pair_key').notNull(),
    status: text('status', { enum: ['pending', 'accepted'] })
      .notNull()
      .default('pending'),
    createdAt: createdAt(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('friendships_pair_idx').on(t.pairKey),
    index('friendships_requester_idx').on(t.requesterId),
    index('friendships_addressee_idx').on(t.addresseeId),
  ],
);

export const directMessages = outpost.table(
  'direct_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** chave da conversa (ids ordenados) para listar o histórico com um único índice */
    pairKey: text('pair_key').notNull(),
    text: text('text').notNull(),
    createdAt: createdAt(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    index('dm_pair_created_idx').on(t.pairKey, t.createdAt),
    index('dm_unread_idx').on(t.recipientId, t.senderId).where(sql`${t.readAt} is null`),
  ],
);

/**
 * Mundos salvos (um por código de sala). `state` é o JSON do jogo (relógio, painéis, canteiros,
 * rover e missão) do ÚLTIMO jogador que salvou.
 */
export const worlds = outpost.table('worlds', {
  code: text('code').primaryKey(),
  baseId: text('base_id').notNull(),
  state: jsonb('state').notNull(),
  createdAt: createdAt(),
  savedAt: timestamp('saved_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Vínculo jogador <-> mundo. `owner` é `u:<id da conta>` ou `k:<HMAC da chave do cookie>`
 * (a chave em si nunca é guardada). O vínculo vence se o jogador não voltar em 30 dias; um mundo
 * sem nenhum vínculo é apagado.
 */
export const worldLinks = outpost.table(
  'world_links',
  {
    owner: text('owner').notNull(),
    worldCode: text('world_code')
      .notNull()
      .references(() => worlds.code, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull().default(''),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.worldCode] }),
    index('world_links_seen_idx').on(t.lastSeenAt),
  ],
);

export const schema = {
  users,
  sessions,
  passwordResets,
  friendships,
  directMessages,
  worlds,
  worldLinks,
};

/** Chave estável de um par de usuários, independente de quem é quem. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
