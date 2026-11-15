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

/**
 * Jogador temporário: nasce quando o visitante aceita o cookie de salvamento e é apagado se ficar
 * 30 dias sem jogar (os vínculos dele caem junto). Não há conta, e-mail nem senha: a chave do
 * cookie só existe aqui como HMAC.
 */
export const players = outpost.table(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyHash: text('key_hash').notNull(),
    nickname: text('nickname').notNull().default(''),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('players_key_idx').on(t.keyHash), index('players_seen_idx').on(t.lastSeenAt)],
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
 * Vínculo jogador <-> mundo, permanente enquanto o jogador existir. Até 4 jogadores por mundo e
 * até 5 mundos por jogador. Mundo sem nenhum vínculo é apagado.
 */
export const worldLinks = outpost.table(
  'world_links',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    worldCode: text('world_code')
      .notNull()
      .references(() => worlds.code, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull().default(''),
    /** traje deste jogador NESTE mundo (escolhido ao criar/entrar pela primeira vez) */
    suit: jsonb('suit'),
    linkedAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.worldCode] }),
    index('world_links_seen_idx').on(t.lastSeenAt),
    index('world_links_world_idx').on(t.worldCode),
  ],
);

export const schema = { players, worlds, worldLinks };
