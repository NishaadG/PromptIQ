/** Shapes data for the client (DTOs) and assembles page-level payloads. */
import type { DB } from "../db/client";
import type { Attempt, User } from "../db/schema";
import { levelFromXp } from "../../scoring";
import { listUserAttempts } from "./attempts";
import { dashboardStats, recommendTask } from "./catalog";

export function toClientAttempt(a: Attempt) {
  return {
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
