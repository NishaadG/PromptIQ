/**
 * Database-backed fixed-window rate limiter. One atomic upsert per call, so the limit holds
 * across serverless instances and restarts.
 */
import { lt, sql } from "drizzle-orm";
import type { DB } from "./db/client";
import { rateLimits } from "./db/schema";

/** Count a hit against `key`; returns whether it is within `limit` for the current window. */
export async function hit(db: DB, key: string, limit: number, windowMs: number): Promise<{ ok: boolean; count: number; resetAt: Date }> {
  const fresh = new Date(Date.now() + windowMs);
  const expired = sql`${rateLimits.resetAt} < now()`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: fresh })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${expired} then excluded.reset_at else ${rateLimits.resetAt} end`,
      },
    })
    .returning();
  if (Math.random() < 0.01) await db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date(Date.now() - 864e5)));
  return { ok: row.count <= limit, count: row.count, resetAt: row.resetAt };
}
