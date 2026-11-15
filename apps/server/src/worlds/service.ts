import { restoreIntegrity } from '@mars/shared';
import { createHmac, randomBytes } from 'node:crypto';
import {
  GAME_MAX_CROPS,
  GAME_MAX_SOLAR,
  normalizeCare,
  type RecentWorld,
  WORLD_LINK_DAYS,
  WORLD_MISSION_MAX_BYTES,
  type WorldSave,
} from '@mars/shared';
import { and, desc, eq, lt, notExists, sql } from 'drizzle-orm';
import { loadAuth } from '../auth/sessions';
import { config } from '../config';
import { db } from '../db/client';
import { worldLinks, worlds } from '../db/schema';
import { verifyToken } from '../security/tokens';

/** Nome do cookie (HttpOnly) com a chave aleatória que liga um visitante aos mundos dele. */
export const PLAYER_KEY_COOKIE = 'mo_pk';
const KEY_RE = /^[a-f0-9]{48}$/;

export const newPlayerKey = () => randomBytes(24).toString('hex');

/** Só o HMAC da chave vai para o banco: um vazamento da tabela não entrega os cookies. */
const hashKey = (key: string) =>
  createHmac('sha256', config.jwtSecret).update(`player-key:${key}`).digest('hex');

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/**
 * Quem é o dono do vínculo: a conta (se logada) ou a chave do cookie (convidado).
 * `null` = visitante sem conta e sem cookie aceito: pode jogar, mas não salvar.
 */
export async function ownerFromCookies(header: string | undefined): Promise<string | null> {
  const c = parseCookies(header);
  const token = c[config.cookies.access];
  if (token) {
    const claims = await verifyToken(token, 'access');
    const auth = claims ? await loadAuth(claims) : null;
    if (auth) return `u:${auth.user.id}`;
  }
  const key = c[PLAYER_KEY_COOKIE];
  return key && KEY_RE.test(key) ? `k:${hashKey(key)}` : null;
}

/** Valida o JSON recebido do cliente: só números pequenos e listas limitadas. */
export function sanitizeSave(raw: {
  integrity?: unknown;
  elapsedMs: number;
  solar: number[];
  crops: number[];
  vehicle?: { x: number; z: number; h: number };
  timeScale?: unknown;
  paused?: unknown;
  care?: unknown;
  mission?: unknown;
}): WorldSave | null {
  const clampList = (l: number[], max: number, top: number) =>
    l.slice(0, max).map((n) => Math.max(0, Math.min(top, Math.round(Number(n) || 0))));
  const save: WorldSave = {
    v: 2,
    integrity: restoreIntegrity(raw.integrity),
    elapsedMs: Math.max(0, Math.min(1e12, Math.round(raw.elapsedMs))),
    solar: clampList(raw.solar, GAME_MAX_SOLAR, 4),
    crops: clampList(raw.crops, GAME_MAX_CROPS, 3),
  };
  if (raw.vehicle) save.vehicle = raw.vehicle;
  if (raw.timeScale === 2 || raw.timeScale === 3) save.timeScale = raw.timeScale;
  if (raw.paused === true) save.paused = true;
  const care = normalizeCare(raw.care);
  if (care) save.care = care;
  if (raw.mission !== undefined) {
    let json = '';
    try {
      json = JSON.stringify(raw.mission) ?? '';
    } catch {
      return null;
    }
    if (json.length > WORLD_MISSION_MAX_BYTES) return null;
    save.mission = JSON.parse(json);
  }
  return save;
}

export async function loadWorld(code: string) {
  const [row] = await db.select().from(worlds).where(eq(worlds.code, code)).limit(1);
  return row ? { baseId: row.baseId, save: row.state as WorldSave, savedAt: row.savedAt } : null;
}

/** Grava (sobrescreve) o mundo: vale sempre o estado do último jogador que salvou. */
export async function saveWorld(code: string, baseId: string, save: WorldSave) {
  const now = new Date();
  await db
    .insert(worlds)
    .values({ code, baseId, state: save, savedAt: now })
    .onConflictDoUpdate({ target: worlds.code, set: { state: save, baseId, savedAt: now } });
}

/** Cria ou renova o vínculo (zera a contagem dos 30 dias). */
export async function touchLink(owner: string, code: string, nickname: string) {
  await db
    .insert(worldLinks)
    .values({ owner, worldCode: code, nickname, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [worldLinks.owner, worldLinks.worldCode],
      set: { nickname, lastSeenAt: new Date() },
    });
}

export async function hasLink(owner: string, code: string) {
  const [row] = await db
    .select({ c: worldLinks.worldCode })
    .from(worldLinks)
    .where(and(eq(worldLinks.owner, owner), eq(worldLinks.worldCode, code)))
    .limit(1);
  return Boolean(row);
}

export async function listRecent(owner: string): Promise<RecentWorld[]> {
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
    .where(eq(worldLinks.owner, owner))
    .orderBy(desc(worldLinks.lastSeenAt))
    .limit(30);
  return rows.map((r) => ({
    code: r.code,
    baseId: r.baseId,
    nickname: r.nickname,
    savedAt: r.savedAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  }));
}

/** Remove o vínculo de um jogador; sem vínculos restantes, o mundo é apagado. */
export async function unlink(owner: string, code: string) {
  await db
    .delete(worldLinks)
    .where(and(eq(worldLinks.owner, owner), eq(worldLinks.worldCode, code)));
  await purgeOrphanWorlds();
}

async function purgeOrphanWorlds() {
  await db
    .delete(worlds)
    .where(
      notExists(
        db.select({ x: sql`1` }).from(worldLinks).where(eq(worldLinks.worldCode, worlds.code)),
      ),
    );
}

/** Vínculos sem uso há mais de 30 dias caem; mundos que ficaram sem vínculo são apagados. */
export async function purgeExpired() {
  const limit = new Date(Date.now() - WORLD_LINK_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(worldLinks).where(lt(worldLinks.lastSeenAt, limit));
  await purgeOrphanWorlds();
}
