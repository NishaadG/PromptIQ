import { randomUUID } from "node:crypto";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { attempts, tasks, users, type Task, type User } from "../db/schema";
import { composeUserMessage, getProvider, type LlmProvider } from "../llm";
import { computeReward, nextStreak, scoreAttempt, updateRatings, xpForAttempt } from "../../scoring";

export const MAX_PROMPT_CHARS = 8000;
export const MAX_ATTEMPTS_PER_TASK_PER_DAY = 10;

export class AttemptError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Run the learner's prompt through the model, score it, and store the attempt (unclaimed). */
export async function runAttempt(db: DB, user: User, taskId: string, prompt: string, provider: LlmProvider = getProvider()) {
  const trimmed = prompt.trim();
  if (!trimmed) throw new AttemptError(400, "Prompt is empty");
  if (trimmed.length > MAX_PROMPT_CHARS) throw new AttemptError(400, `Prompt is too long (max ${MAX_PROMPT_CHARS} characters)`);

  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.active, true))).limit(1);
  if (!task) throw new AttemptError(404, "Task not found");

  const since = new Date(Date.now() - 864e5);
  const [{ n: today }] = await db
    .select({ n: count() })
    .from(attempts)
    .where(and(eq(attempts.userId, user.id), eq(attempts.taskId, task.id), sql`${attempts.createdAt} > ${since}`));
  if (today >= MAX_ATTEMPTS_PER_TASK_PER_DAY) throw new AttemptError(429, "Daily attempt limit reached for this task — try another task");

  const message = composeUserMessage(trimmed, task.context);
  const completion = await provider.complete({ user: message, maxTokens: Math.max(256, task.tokenBudget), task, learnerPrompt: trimmed });
  const s = scoreAttempt({ task, prompt: trimmed, response: completion.text, promptTokens: completion.inputTokens, outputTokens: completion.outputTokens });
  const { reward, bonus } = computeReward(task.reward, s.taskSuccess, s.efficiency);

  const [{ n: prior }] = await db.select({ n: count() }).from(attempts).where(and(eq(attempts.userId, user.id), eq(attempts.taskId, task.id)));
  const [row] = await db
    .insert(attempts)
    .values({
      id: randomUUID(), userId: user.id, taskId: task.id, attemptNumber: prior + 1,
      prompt: trimmed, response: completion.text, provider: completion.provider, model: completion.model,
      promptTokens: completion.inputTokens, outputTokens: completion.outputTokens, totalTokens: s.totalTokens,
      latencyMs: completion.latencyMs, taskSuccess: s.taskSuccess, efficiency: s.efficiency, clarity: s.clarity,
      criteria: s.criteria, techniques: s.techniques, feedback: s.feedback, reward, bonus,
    })
    .returning();
  return { attempt: row, task, percentile: await percentileOf(db, task.id, s.taskSuccess) };
}

/** Share of all attempts on this task that scored at or below this one (for "top X%"). */
async function percentileOf(db: DB, taskId: string, score: number) {
  const [{ total, below }] = await db
    .select({ total: count(), below: sql<number>`count(*) filter (where ${attempts.taskSuccess} <= ${score})` })
    .from(attempts)
    .where(eq(attempts.taskId, taskId));
  return total ? Math.round((100 * Number(below)) / Number(total)) : 100;
}

/**
 * Claim an attempt's reward. Anti-farming: per task you only ever earn your *best* result —
 * claiming a better attempt pays the difference; re-claiming an equal or worse one pays nothing.
 * XP and adaptive ratings update on every claim; the daily streak updates too.
 */
export async function claimAttempt(db: DB, user: User, attemptId: string) {
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(attempts).where(and(eq(attempts.id, attemptId), eq(attempts.userId, user.id))).limit(1);
    if (!a) throw new AttemptError(404, "Attempt not found");
    if (a.claimed) throw new AttemptError(409, "Already claimed");

    const [{ best }] = await tx
      .select({ best: sql<number>`coalesce(max(${attempts.reward} + ${attempts.bonus}), 0)` })
      .from(attempts)
      .where(and(eq(attempts.userId, user.id), eq(attempts.taskId, a.taskId), eq(attempts.claimed, true)));
    const earned = Math.max(0, a.reward + a.bonus - Number(best));

    const [task] = await tx.select().from(tasks).where(eq(tasks.id, a.taskId)).limit(1);
    const [fresh] = await tx.select().from(users).where(eq(users.id, user.id)).limit(1);
    const ratings = updateRatings(fresh.rating, task.difficultyRating, a.taskSuccess);
    const streak = nextStreak(fresh);
    const xpGain = xpForAttempt(a.taskSuccess, a.efficiency);

    await tx.update(attempts).set({ claimed: true }).where(eq(attempts.id, a.id));
    const [updated] = await tx
      .update(users)
      .set({ tokens: fresh.tokens + earned, xp: fresh.xp + xpGain, rating: ratings.user, ...streak })
      .where(eq(users.id, user.id))
      .returning();
    await tx.update(tasks).set({ difficultyRating: ratings.task }).where(eq(tasks.id, task.id));
    return { earned, xpGain, user: updated };
  });
}

export async function listUserAttempts(db: DB, userId: string, limit = 20) {
  return db
    .select({
      id: attempts.id, taskId: attempts.taskId, title: tasks.title, category: tasks.category,
      taskSuccess: attempts.taskSuccess, efficiency: attempts.efficiency, totalTokens: attempts.totalTokens,
      claimed: attempts.claimed, createdAt: attempts.createdAt,
    })
    .from(attempts)
    .innerJoin(tasks, eq(tasks.id, attempts.taskId))
    .where(eq(attempts.userId, userId))
    .orderBy(desc(attempts.createdAt))
    .limit(limit);
}

export async function getAttempt(db: DB, userId: string, attemptId: string) {
  const [a] = await db.select().from(attempts).where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId))).limit(1);
  return a ?? null;
}

export type TaskForClient = Omit<Task, "rubric" | "simulatedResponse" | "difficultyRating" | "createdAt" | "active"> & {
  criteria: string[];
};
