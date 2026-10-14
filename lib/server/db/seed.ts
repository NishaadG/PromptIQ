import { randomBytes, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { DB } from "./client";
import { tasks, users } from "./schema";
import { DEMO_LOGIN, DEMO_USERS, SEED_TASKS } from "./seed-data";
import { hashPassword } from "../auth/password";

/** Idempotent: upserts the item bank (keeping learned difficulty ratings) and creates demo users once. */
export async function seed(db: DB, opts: { demoUsers?: boolean } = {}) {
  for (const t of SEED_TASKS) {
    const { difficultyRating, ...content } = t;
    await db.insert(tasks).values(t).onConflictDoUpdate({ target: tasks.id, set: content });
    void difficultyRating;
  }
  if (opts.demoUsers === false) return;

  for (const d of DEMO_USERS) {
    const handle = d.name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.handle, handle)).limit(1);
    if (exists.length) continue;
    await db.insert(users).values({
      id: randomUUID(), email: `${handle}@demo.promptiq.dev`, name: d.name, handle, org: d.org,
      passwordHash: await hashPassword(randomBytes(24).toString("base64url")), // not loggable-into
      xp: d.xp, tokens: d.tokens, currentStreak: d.streak, longestStreak: d.streak,
      rating: 1000 + d.xp / 20, isDemo: true,
    });
  }
  const demo = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, DEMO_LOGIN.email)).limit(1);
  if (!demo.length) {
    await db.insert(users).values({
      id: randomUUID(), email: DEMO_LOGIN.email, name: DEMO_LOGIN.name, handle: "demo",
      passwordHash: await hashPassword(DEMO_LOGIN.password), isDemo: true,
    });
  }
}
