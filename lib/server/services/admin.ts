/** Item-bank administration: authoring, statistics and empirical recalibration of tasks. */
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "../db/client";
import { attempts, tasks, users, type User } from "../db/schema";

export function isAdmin(user: Pick<User, "role" | "email">) {
  const allow = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return user.role === "admin" || allow.includes(user.email.toLowerCase());
}

const weight = z.number().positive().max(100);
const label = z.string().min(1).max(160);
export const criterionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("includes_any"), label, terms: z.array(z.string().min(1)).min(1), weight }),
  z.object({ kind: z.literal("includes_all"), label, terms: z.array(z.string().min(1)).min(1), weight }),
  z.object({ kind: z.literal("excludes"), label, terms: z.array(z.string().min(1)).min(1), weight }),
  z.object({ kind: z.literal("max_words"), label, max: z.number().int().positive(), weight }),
  z.object({ kind: z.literal("min_items"), label, min: z.number().int().positive(), weight }),
  z.object({ kind: z.literal("json_fields"), label, fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])), weight }),
  z.object({
    kind: z.literal("regex"), label, weight, flags: z.string().regex(/^[gimsuy]*$/).optional(),
    pattern: z.string().min(1).refine((p) => { try { new RegExp(p); return true; } catch { return false; } }, "invalid regular expression"),
  }),
  z.object({ kind: z.literal("llm_judge"), label, question: z.string().min(5), weight }),
]);

export const taskInputSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/, "lowercase slug, 3–60 chars"),
  title: z.string().min(3).max(160),
  category: z.string().min(2).max(60),
  domain: z.enum(["summarization", "extraction", "rewriting", "explanation", "classification", "reasoning", "code", "qa"]),
  difficulty: z.enum(["Foundational", "Intermediate", "Advanced"]),
  estMinutes: z.number().int().min(1).max(120),
  reward: z.number().int().min(10).max(1000),
  brief: z.string().min(20).max(4000),
  contextLabel: z.string().max(160),
  context: z.string().max(20000),
  tokenBudget: z.number().int().min(50).max(20000),
  rubric: z.array(criterionSchema).min(1).max(20),
  simulatedResponse: z.string().min(1).max(10000),
  samplePrompt: z.string().min(1).max(8000),
  medianScore: z.number().int().min(0).max(100).default(70),
  medianTokens: z.number().int().positive().default(500),
  active: z.boolean().default(true),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

const DIFFICULTY_RATING = { Foundational: 900, Intermediate: 1000, Advanced: 1100 } as const;

export async function upsertTask(db: DB, input: TaskInput) {
  const [{ maxNo }] = await db.select({ maxNo: sql<number>`coalesce(max(${tasks.number}), 0)` }).from(tasks);
  const [existing] = await db.select({ number: tasks.number }).from(tasks).where(eq(tasks.id, input.id)).limit(1);
  const values = { ...input, number: existing?.number ?? Number(maxNo) + 1 };
  const [row] = await db
    .insert(tasks)
    .values({ ...values, difficultyRating: DIFFICULTY_RATING[input.difficulty] })
    .onConflictDoUpdate({ target: tasks.id, set: values }) // keeps the learned difficulty rating
    .returning();
  return row;
}

export async function setTaskActive(db: DB, id: string, active: boolean) {
  const [row] = await db.update(tasks).set({ active }).where(eq(tasks.id, id)).returning();
  return row ?? null;
}

/** Item statistics from real attempts (classical test theory: p-value / mean score, spread). */
export async function itemStats(db: DB) {
  const rows = await db.select().from(tasks).orderBy(asc(tasks.number));
  const stats = await db
    .select({
      taskId: attempts.taskId,
      n: sql<number>`count(*)`,
      learners: sql<number>`count(distinct ${attempts.userId})`,
      meanScore: sql<number>`round(avg(${attempts.taskSuccess}))`,
      medianScore: sql<number>`percentile_cont(0.5) within group (order by ${attempts.taskSuccess})`,
      medianTokens: sql<number>`percentile_cont(0.5) within group (order by ${attempts.totalTokens})`,
      passRate: sql<number>`round(100.0 * avg(case when ${attempts.taskSuccess} >= 60 then 1 else 0 end))`,
    })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(eq(users.isDemo, false))
    .groupBy(attempts.taskId);
  const by = new Map(stats.map((s) => [s.taskId, s]));
  return rows.map((t) => {
    const s = by.get(t.id);
    return {
      task: t,
      attempts: Number(s?.n ?? 0), learners: Number(s?.learners ?? 0),
      meanScore: s ? Number(s.meanScore) : null, observedMedianScore: s ? Math.round(Number(s.medianScore)) : null,
      observedMedianTokens: s ? Math.round(Number(s.medianTokens)) : null, passRate: s ? Number(s.passRate) : null,
    };
  });
}

export const MIN_ATTEMPTS_TO_RECALIBRATE = 10;

/** Replace a task's benchmark medians with observed medians once there is enough data. */
export async function recalibrateTask(db: DB, id: string) {
  const s = (await itemStats(db)).find((x) => x.task.id === id);
  if (!s) return { ok: false as const, reason: "Task not found" };
  if (s.attempts < MIN_ATTEMPTS_TO_RECALIBRATE) return { ok: false as const, reason: `Need at least ${MIN_ATTEMPTS_TO_RECALIBRATE} real attempts (have ${s.attempts})` };
  const [row] = await db
    .update(tasks)
    .set({ medianScore: s.observedMedianScore!, medianTokens: Math.max(1, s.observedMedianTokens!) })
    .where(eq(tasks.id, id))
    .returning();
  return { ok: true as const, task: row };
}

/** Recent attempts carrying any integrity flag, for human review (signals, not verdicts). */
export async function flaggedAttempts(db: DB, limit = 50) {
  return db
    .select({
      id: attempts.id, createdAt: attempts.createdAt, taskSuccess: attempts.taskSuccess, integrity: attempts.integrity,
      promptChars: sql<number>`length(${attempts.prompt})`, handle: users.handle, taskTitle: tasks.title,
    })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .innerJoin(tasks, eq(tasks.id, attempts.taskId))
    .where(sql`jsonb_array_length(${attempts.integrity}->'flags') > 0`)
    .orderBy(desc(attempts.createdAt))
    .limit(limit);
}
