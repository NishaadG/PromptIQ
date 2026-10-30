/** Shapes data for the client (DTOs) and assembles page-level payloads. */
import type { DB } from "../db/client";
import type { Attempt, User } from "../db/schema";
import { levelFromXp } from "../../scoring";
import { pesComponents, pesGated, pesLinear } from "../../scoring/pes";
import { listUserAttempts } from "./attempts";
import { dashboardStats, recommendTask } from "./catalog";
import { CLOUD_USD_PER_MTOK } from "./lab";

/** Prompt Efficiency Score of a stored attempt, with the task's median spend as the token and cost reference. */
export function attemptPes(a: Pick<Attempt, "provider" | "clarity" | "taskSuccess" | "totalTokens" | "latencyMs">, medianTokens: number) {
  const price = a.provider === "simulated-local" || a.provider === "local" ? 0 : CLOUD_USD_PER_MTOK;
  const components = pesComponents({
    clarity: a.clarity, taskSuccess: a.taskSuccess, totalTokens: a.totalTokens, latencyMs: a.latencyMs,
    costUsd: (a.totalTokens * price) / 1e6, medianTokens, referenceCostUsd: (medianTokens * price) / 1e6,
  });
  return { components, linear: pesLinear(components), gated: pesGated(components) };
}

export function toClientAttempt(a: Attempt, medianTokens: number) {
  return {
    pes: attemptPes(a, medianTokens),
    id: a.id, taskId: a.taskId, attemptNumber: a.attemptNumber, response: a.response,
    provider: a.provider, model: a.model, latencyMs: a.latencyMs,
    promptTokens: a.promptTokens, outputTokens: a.outputTokens, totalTokens: a.totalTokens,
    taskSuccess: a.taskSuccess, efficiency: a.efficiency, clarity: a.clarity,
    criteria: a.criteria, techniques: a.techniques, feedback: a.feedback,
    reward: a.reward, bonus: a.bonus, claimed: a.claimed, createdAt: a.createdAt.toISOString(),
  };
}
export type ClientAttempt = ReturnType<typeof toClientAttempt>;

export function progressOf(u: User) {
  const lv = levelFromXp(u.xp);
  return { ...lv, xp: u.xp, tokens: u.tokens, streak: u.currentStreak, longestStreak: u.longestStreak, rating: Math.round(u.rating) };
}

export async function getDashboard(db: DB, user: User) {
  const [stats, recent, next] = await Promise.all([
    dashboardStats(db, user.id),
    listUserAttempts(db, user.id, 6),
    recommendTask(db, user.id, user.rating),
  ]);
  return {
    user: { name: user.name, handle: user.handle, org: user.org },
    progress: progressOf(user),
    stats,
    recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    next,
  };
}
