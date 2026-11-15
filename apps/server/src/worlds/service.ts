import { type SuitConfig, normalizeSuit } from '@mars/shared';
import { createWorldSave, migrateWorldSave, validSaveSize } from '@mars/sim';
import {
  type RecentWorld,
  WORLD_LINK_DAYS,
  type WorldSave,
} from '@mars/shared';
import { and, count, desc, eq, inArray, lt, notExists, sql } from 'drizzle-orm';
import { createHmac, randomBytes } from 'node:crypto';
import { config } from '../config';
import { db } from '../db/client';
import { players, worldLinks, worlds } from '../db/schema';

/** Nome do cookie (HttpOnly) com a chave aleatória que identifica o jogador neste navegador. */
export const PLAYER_KEY_COOKIE = 'mo_pk';
const KEY_RE = /^[a-f0-9]{48}$/;

/** Quantos jogadores podem ficar vinculados ao mesmo mundo. */
export const MAX_PLAYERS_PER_WORLD = 4;
/** Quantos mundos cada jogador guarda em "Meus mundos"; o mais antigo sai quando passa disso. */
export const MAX_WORLDS_PER_OWNER = 5;

export const newPlayerKey = () => randomBytes(24).toString('hex');
export const validPlayerKey = (key: string | undefined): key is string => !!key && KEY_RE.test(key);

/** Só o HMAC da chave vai para o banco: um vazamento da tabela não entrega os cookies. */
const hashKey = (key: string) =>
  createHmac('sha256', config.jwtSecret).update(`player-key:${key}`).digest('hex');

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* cookie malformado: ignora */
    }
  }
  return out;
}

/** Cria (ou renova) o jogador dono desta chave e devolve o id dele. */
export async function ensurePlayer(key: string): Promise<string> {
  const [row] = await db
    .insert(players)
    .values({ keyHash: hashKey(key) })
    .onConflictDoUpdate({ target: players.keyHash, set: { lastSeenAt: new Date() } })
    .returning({ id: players.id });
  return row!.id;
}

/**
 * Quem é o jogador deste cookie (recria o registro se ele foi apagado por inatividade).
 * `null` = sem cookie aceito: pode jogar, mas não salvar.
 */
export async function playerFromCookies(header: string | undefined): Promise<string | null> {
  const key = parseCookies(header)[PLAYER_KEY_COOKIE];
  return validPlayerKey(key) ? ensurePlayer(key) : null;
}

/** Structural migration is shared with the simulation owner; size counts UTF-8 bytes. */
export function sanitizeSave(raw: unknown): WorldSave | null {
  if(!validSaveSize(raw))return null;
  const {state}=migrateWorldSave(raw,1,'migration');
  const vehicle=(raw as WorldSave | undefined)?.vehicle;
  const validVehicle=vehicle && [vehicle.x,vehicle.z,vehicle.h].every(n=>typeof n==='number' && Number.isFinite(n) && Math.abs(n)<=200) ? vehicle : undefined;
  return createWorldSave(state,validVehicle);
}

export async function loadWorld(code: string) {
  const [row] = await db.select().from(worlds).where(eq(worlds.code, code)).limit(1);
  return row ? { baseId: row.baseId, save: row.state as WorldSave, savedAt: row.savedAt } : null;
}

/** Grava (sobrescreve) o mundo: vale sempre o estado do último jogador que salvou. */
export async function saveWorld(code: string, baseId: string, save: WorldSave) {
  if(!validSaveSize(save))throw new Error('Salvamento excede 256 KiB.');
  const now = new Date();
  await db
    .insert(worlds)
    .values({ code, baseId, state: save, savedAt: now })
    .onConflictDoUpdate({ target: worlds.code, set: { state: save, baseId, savedAt: now } });
}

export async function linkCount(code: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(worldLinks)
    .where(eq(worldLinks.worldCode, code));
  return row?.n ?? 0;
}

export async function hasLink(playerId: string, code: string) {
  const [row] = await db
    .select({ c: worldLinks.worldCode })
    .from(worldLinks)
    .where(and(eq(worldLinks.playerId, playerId), eq(worldLinks.worldCode, code)))
    .limit(1);
  return Boolean(row);
}

/** Um jogador novo só se vincula se o mundo ainda tiver vaga (máx. 4). */
export async function canLink(playerId: string, code: string): Promise<boolean> {
  if (await hasLink(playerId, code)) return true;
  return (await linkCount(code)) < MAX_PLAYERS_PER_WORLD;
}

/**
 * Cria ou renova o vínculo e mantém só os 5 mundos mais recentes do jogador. Devolve `false`
 * (sem criar nada) se o mundo já tem 4 jogadores vinculados e este não é um deles.
 */
export async function touchLink(
  playerId: string,
  code: string,
  nickname: string,
  suit?: SuitConfig,
): Promise<boolean> {
  if (!(await canLink(playerId, code))) return false;
  const now = new Date();
  await db
    .insert(worldLinks)
    .values({ playerId, worldCode: code, nickname, suit: suit ?? null, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [worldLinks.playerId, worldLinks.worldCode],
      set: { nickname, lastSeenAt: now },
    });
  await db.update(players).set({ nickname, lastSeenAt: now }).where(eq(players.id, playerId));
  const extra = await db
    .select({ code: worldLinks.worldCode })
    .from(worldLinks)
    .where(eq(worldLinks.playerId, playerId))
    .orderBy(desc(worldLinks.lastSeenAt))
    .offset(MAX_WORLDS_PER_OWNER);
  if (extra.length) {
    // Só ESTE jogador perde o vínculo; quem mais estiver ligado ao mundo continua com ele.
    const codes = extra.map((r) => r.code);
    await db
      .delete(worldLinks)
      .where(and(eq(worldLinks.playerId, playerId), inArray(worldLinks.worldCode, codes)));
    await purgeOrphanWorlds(codes);
  }
  return true;
}

/** Traje que este jogador escolheu neste mundo (`null` = ainda não tem vínculo/traje). */
export async function linkSuit(playerId: string, code: string): Promise<SuitConfig | null> {
  const [row] = await db
    .select({ suit: worldLinks.suit })
    .from(worldLinks)
    .where(and(eq(worldLinks.playerId, playerId), eq(worldLinks.worldCode, code)))
    .limit(1);
  return row?.suit ? normalizeSuit(row.suit) : null;
}

/** Base de um mundo já salvo (para quem entra só pelo código). */
export async function worldBase(code: string): Promise<string | null> {
  const [row] = await db
    .select({ b: worlds.baseId })
    .from(worlds)
    .where(eq(worlds.code, code))
    .limit(1);
  return row?.b ?? null;
}

export async function listRecent(playerId: string): Promise<RecentWorld[]> {
  const rows = await db
    .select({
      code: worlds.code,
      baseId: worlds.baseId,
      savedAt: worlds.savedAt,
      lastSeenAt: worldLinks.lastSeenAt,
      nickname: worldLinks.nickname,
    })
    .from(worldLinks)
    .innerJoin(worlds, eq(worlds.code, worldLinks.worldCode))
    .where(eq(worldLinks.playerId, playerId))
    .orderBy(desc(worldLinks.lastSeenAt))
    .limit(MAX_WORLDS_PER_OWNER);
  return rows.map((r) => ({
    code: r.code,
    baseId: r.baseId,
    nickname: r.nickname,
    savedAt: r.savedAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  }));
}

/** Remove o vínculo de um jogador; sem vínculos restantes, o mundo é apagado. */
export async function unlink(playerId: string, code: string) {
  await db
    .delete(worldLinks)
    .where(and(eq(worldLinks.playerId, playerId), eq(worldLinks.worldCode, code)));
  await purgeOrphanWorlds([code]);
}

/** Apaga o jogador (e os vínculos dele). Mundos que ficarem sem ninguém são apagados. */
export async function forgetPlayer(playerId: string) {
  const codes = (
    await db
      .select({ code: worldLinks.worldCode })
      .from(worldLinks)
      .where(eq(worldLinks.playerId, playerId))
  ).map((r) => r.code);
  await db.delete(players).where(eq(players.id, playerId));
  if (codes.length) await purgeOrphanWorlds(codes);
}

const noLinks = () =>
  notExists(db.select({ x: sql`1` }).from(worldLinks).where(eq(worldLinks.worldCode, worlds.code)));

/**
 * Apaga mundos que ninguém tem em "Meus mundos".
 *  - com `codes`: só esses (o jogador acabou de remover/perder o vínculo), e só se ninguém mais o
 *    tiver nem ele tiver sido gravado no último minuto (há uma sala aberta usando-o);
 *  - sem `codes` (limpeza diária): os que não são gravados há mais de 30 dias. Mundos de quem
 *    joga sem cookie ficam no banco por esse prazo, para sobreviver a reinícios do servidor.
 */
async function purgeOrphanWorlds(codes?: string[]) {
  if (codes) {
    if (!codes.length) return;
    const busy = new Date(Date.now() - 60_000);
    await db
      .delete(worlds)
      .where(and(inArray(worlds.code, codes), lt(worlds.savedAt, busy), noLinks()));
    return;
  }
  const limit = new Date(Date.now() - WORLD_LINK_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(worlds).where(and(lt(worlds.savedAt, limit), noLinks()));
}

/** Jogadores sem jogar há 30 dias caem (com os vínculos); mundos sem ninguém são apagados. */
export async function purgeExpired() {
  const limit = new Date(Date.now() - WORLD_LINK_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(worldLinks).where(lt(worldLinks.lastSeenAt, limit));
  await db.delete(players).where(lt(players.lastSeenAt, limit));
  await purgeOrphanWorlds();
}
