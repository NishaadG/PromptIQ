/**
 * Database-backed sessions. The browser holds a random 256-bit token in an httpOnly cookie;
 * the database stores only sha256(token), so a leaked DB row cannot be replayed as a cookie.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { DB } from "../db/client";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE = "piq_session";
export const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: DB, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(db: DB, token: string | undefined) {
  if (!token) return null;
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Sliding expiry: extend sessions that are past half-life.
  if (row.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * 864e5) {
    await db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5) }).where(eq(sessions.id, row.sessionId));
  }
  return row.user;
}

export async function deleteSession(db: DB, token: string | undefined) {
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function purgeExpiredSessions(db: DB) {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/** Sign out everywhere (used after a password change). */
export async function deleteUserSessions(db: DB, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
