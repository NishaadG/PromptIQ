import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { attempts, tasks, users, type Task } from "../db/schema";
import { levelFromXp } from "../../scoring";

/** What a learner may see of a task — never the rubric internals or the reference response. */
export function toClientTask(t: Task) {
  return {
    id: t.id, number: t.number, title: t.title, category: t.category, domain: t.domain, difficulty: t.difficulty,
    estMinutes: t.estMinutes, reward: t.reward, brief: t.brief, contextLabel: t.contextLabel, context: t.context,
    tokenBudget: t.tokenBudget, samplePrompt: t.samplePrompt, medianScore: t.medianScore, medianTokens: t.medianTokens,
    criteria: t.rubric.map((c) => c.label),
  };
}
export type ClientTask = ReturnType<typeof toClientTask>;

export async function listTasksForUser(db: DB, userId: string) {
  const rows = await db.select().from(tasks).where(eq(tasks.active, true)).orderBy(asc(tasks.number));
  const stats = await db
    .select({ taskId: attempts.taskId, best: sql<number>`max(${attempts.taskSuccess})`, n: sql<number>`count(*)`, claimed: sql<boolean>`bool_or(${attempts.claimed})` })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .groupBy(attempts.taskId);
  const byTask = new Map(stats.map((s) => [s.taskId, s]));
  return rows.map((t) => {
    const s = byTask.get(t.id);
    const status: "new" | "in-progress" | "done" = !s ? "new" : s.claimed && Number(s.best) >= 60 ? "done" : "in-progress";
    return { ...toClientTask(t), status, bestScore: s ? Number(s.best) : undefined, attempts: s ? Number(s.n) : 0 };
  });
}

export async function getTask(db: DB, id: string) {
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.active, true))).limit(1);
  return t ?? null;
}

/**
 * Adaptive recommendation (IRT-lite): the unfinished task whose difficulty rating is closest to
 * the learner's ability rating plus a small stretch, so the expected score sits around ~65%.
 */
export async function recommendTask(db: DB, userId: string, userRating: number) {
  const list = await listTasksForUser(db, userId);
  const all = await db.select({ id: tasks.id, r: tasks.difficultyRating }).from(tasks).where(eq(tasks.active, true));
  const rating = new Map(all.map((x) => [x.id, x.r]));
  const target = userRating + 100;
  const candidates = list.filter((t) => t.status !== "done");
  const pool = candidates.length ? candidates : list;
  return pool.sort((a, b) => Math.abs(rating.get(a.id)! - target) - Math.abs(rating.get(b.id)! - target))[0] ?? null;
}

export async function leaderboard(db: DB, opts: { period: "week" | "all"; limit?: number; currentUserId?: string }) {
  const limit = opts.limit ?? 25;
  if (opts.period === "all") {
    const rows = await db.select().from(users).orderBy(desc(users.tokens), asc(users.createdAt)).limit(limit);
    return Promise.all(rows.map(async (u, i) => ({
      rank: i + 1, id: u.id, name: u.name, org: u.org ?? "Independent", level: levelFromXp(u.xp).level,
      tokens: u.tokens, efficiency: await avgEfficiency(db, u.id), isYou: u.id === opts.currentUserId,
    })));
  }
  const since = new Date(Date.now() - 7 * 864e5);
  const rows = await db
    .select({
      id: users.id, name: users.name, org: users.org, xp: users.xp,
      earned: sql<number>`coalesce(sum(${attempts.reward} + ${attempts.bonus}) filter (where ${attempts.claimed}), 0)`,
      efficiency: sql<number>`coalesce(round(avg(${attempts.efficiency})), 0)`,
    })
    .from(users)
    .innerJoin(attempts, and(eq(attempts.userId, users.id), gte(attempts.createdAt, since)))
    .groupBy(users.id)
    .orderBy(sql`3 desc`)
    .limit(limit);
  return rows.map((r, i) => ({
    rank: i + 1, id: r.id, name: r.name, org: r.org ?? "Independent", level: levelFromXp(r.xp).level,
    tokens: Number(r.earned), efficiency: Number(r.efficiency), isYou: r.id === opts.currentUserId,
  }));
}

async function avgEfficiency(db: DB, userId: string) {
  const [r] = await db.select({ e: sql<number>`coalesce(round(avg(${attempts.efficiency})), 0)` }).from(attempts).where(eq(attempts.userId, userId));
  return Number(r?.e ?? 0);
}

/** Dashboard numbers for one learner. */
export async function dashboardStats(db: DB, userId: string) {
  const since = new Date(Date.now() - 6 * 864e5);
  since.setUTCHours(0, 0, 0, 0);
  const daily = await db
    .select({
      day: sql<string>`to_char(${attempts.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      earned: sql<number>`coalesce(sum(${attempts.reward} + ${attempts.bonus}) filter (where ${attempts.claimed}), 0)`,
    })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), gte(attempts.createdAt, since)))
    .groupBy(sql`1`);
  const byDay = new Map(daily.map((d) => [d.day, Number(d.earned)]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since.getTime() + i * 864e5).toISOString().slice(0, 10);
    return { day: d, earned: byDay.get(d) ?? 0 };
  });
  const [agg] = await db
    .select({
      n: sql<number>`count(*)`, avgSuccess: sql<number>`coalesce(round(avg(${attempts.taskSuccess})), 0)`,
      avgEfficiency: sql<number>`coalesce(round(avg(${attempts.efficiency})), 0)`,
      tokensSpent: sql<number>`coalesce(sum(${attempts.totalTokens}), 0)`,
    })
    .from(attempts)
    .where(eq(attempts.userId, userId));
  return {
    week, attempts: Number(agg.n), avgSuccess: Number(agg.avgSuccess), avgEfficiency: Number(agg.avgEfficiency),
    llmTokensSpent: Number(agg.tokensSpent),
  };
}
