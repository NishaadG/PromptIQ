/**
 * Team / organisation view (PromptIQ doc, Module 8): members of the same organisation and an
 * organisational AI-readiness summary. Organisation membership is the free-text `org` field.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "../db/client";
import { attempts, credentials, tasks, users, type User } from "../db/schema";
import { levelFromXp } from "../../scoring";

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  org: z.string().trim().max(80).nullable().optional(),
});

export async function updateProfile(db: DB, userId: string, input: z.infer<typeof profileUpdateSchema>) {
  const patch: Partial<Pick<User, "name" | "org">> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.org !== undefined) patch.org = input.org || null;
  if (!Object.keys(patch).length) return null;
  const [u] = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
  return u;
}

export async function teamOverview(db: DB, org: string) {
  const members = await db.select().from(users).where(eq(sql`lower(${users.org})`, org.toLowerCase()));
  if (!members.length) return null;
  const ids = members.map((m) => m.id);
  const perUser = await db
    .select({
      userId: attempts.userId,
      n: sql<number>`count(*)`,
      success: sql<number>`round(avg(${attempts.taskSuccess}))`,
      efficiency: sql<number>`round(avg(${attempts.efficiency}))`,
      tokens: sql<number>`sum(${attempts.totalTokens})`,
      // tokens saved vs. the task median, for attempts that met the passing bar
      saved: sql<number>`coalesce(sum(greatest(${tasks.medianTokens} - ${attempts.totalTokens}, 0)) filter (where ${attempts.taskSuccess} >= 60), 0)`,
      completed: sql<number>`count(distinct ${attempts.taskId}) filter (where ${attempts.claimed} and ${attempts.taskSuccess} >= 60)`,
    })
    .from(attempts)
    .innerJoin(tasks, eq(tasks.id, attempts.taskId))
    .where(sql`${attempts.userId} in ${ids}`)
    .groupBy(attempts.userId);
  const certs = await db
    .select({ userId: credentials.userId, n: sql<number>`count(*)` })
    .from(credentials)
    .where(and(sql`${credentials.userId} in ${ids}`, eq(credentials.revoked, false), gt(credentials.expiresAt, new Date())))
    .groupBy(credentials.userId);
  const s = new Map(perUser.map((r) => [r.userId, r]));
  const c = new Map(certs.map((r) => [r.userId, Number(r.n)]));

  const rows = members
    .map((m) => {
      const r = s.get(m.id);
      return {
        id: m.id, name: m.name, handle: m.handle, level: levelFromXp(m.xp).level, attempts: Number(r?.n ?? 0),
        avgSuccess: r ? Number(r.success) : null, avgEfficiency: r ? Number(r.efficiency) : null,
        tasksCompleted: Number(r?.completed ?? 0), certificates: c.get(m.id) ?? 0,
        llmTokens: Number(r?.tokens ?? 0), tokensSaved: Number(r?.saved ?? 0),
      };
    })
    .sort((a, b) => (b.avgEfficiency ?? -1) - (a.avgEfficiency ?? -1));

  const active = rows.filter((r) => r.attempts > 0);
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    org: members[0].org!,
    members: rows,
    summary: {
      members: rows.length,
      activeMembers: active.length,
      certifiedShare: Math.round((100 * rows.filter((r) => r.certificates > 0).length) / rows.length),
      avgSuccess: mean(active.map((r) => r.avgSuccess!)),
      avgEfficiency: mean(active.map((r) => r.avgEfficiency!)),
      tokensSaved: rows.reduce((a, r) => a + r.tokensSaved, 0),
      llmTokens: rows.reduce((a, r) => a + r.llmTokens, 0),
    },
  };
}
