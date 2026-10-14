import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type DB } from "@/lib/server/db/client";
import { seed } from "@/lib/server/db/seed";
import { SEED_TASKS } from "@/lib/server/db/seed-data";
import { AccountError, logIn, signUp } from "@/lib/server/services/accounts";
import { claimAttempt, runAttempt } from "@/lib/server/services/attempts";
import { dashboardStats, leaderboard, listTasksForUser, recommendTask } from "@/lib/server/services/catalog";
import { createSession, deleteSession, getSessionUser } from "@/lib/server/auth/sessions";
import { simulatedProvider } from "@/lib/server/llm";

let db: DB;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seed(db, { demoUsers: true });
});
afterAll(() => close());

describe("accounts and sessions", () => {
  it("signs up, logs in, and rejects bad credentials", async () => {
    const u = await signUp(db, { email: "asha@example.com", password: "correct horse" });
    expect(u.handle).toBe("asha");
    await expect(signUp(db, { email: "asha@example.com", password: "another pass" })).rejects.toBeInstanceOf(AccountError);
    expect((await logIn(db, { email: "asha@example.com", password: "correct horse" })).id).toBe(u.id);
    await expect(logIn(db, { email: "asha@example.com", password: "wrong pass" })).rejects.toBeInstanceOf(AccountError);
    await expect(logIn(db, { email: "nobody@example.com", password: "x" })).rejects.toBeInstanceOf(AccountError);
  });
  it("creates, resolves and deletes sessions", async () => {
    const u = await signUp(db, { email: "sess@example.com", password: "password123" });
    const { token } = await createSession(db, u.id);
    expect((await getSessionUser(db, token))?.id).toBe(u.id);
    expect(await getSessionUser(db, "forged-token")).toBeNull();
    await deleteSession(db, token);
    expect(await getSessionUser(db, token)).toBeNull();
  });
});

describe("attempt → score → claim", () => {
  it("scores the sample prompt highly and a lazy prompt poorly", async () => {
    const u = await signUp(db, { email: "learner@example.com", password: "password123" });
    for (const t of SEED_TASKS) {
      const good = await runAttempt(db, u, t.id, t.samplePrompt, simulatedProvider);
      expect(good.attempt.taskSuccess, `${t.id} sample prompt`).toBeGreaterThanOrEqual(80);
      const lazy = await runAttempt(db, u, t.id, "do this", simulatedProvider);
      expect(lazy.attempt.taskSuccess, `${t.id} lazy prompt`).toBeLessThan(good.attempt.taskSuccess);
    }
  });

  it("demonstrates the answer-only compliance trap on the reasoning task", async () => {
    const u = await signUp(db, { email: "trap@example.com", password: "password123" });
    const r = await runAttempt(db, u, "plan-math-07", "Which plan is cheaper per year for 1,500 calls a month? Give only the final answer, no explanation.", simulatedProvider);
    expect(r.attempt.taskSuccess).toBeLessThan(60);
    expect(r.attempt.feedback.some((f) => f.kind === "warn")).toBe(true);
  });

  it("pays only the improvement on re-claims, and updates XP/streak/rating", async () => {
    const u = await signUp(db, { email: "claim@example.com", password: "password123" });
    const first = await runAttempt(db, u, "legal-clause-01", SEED_TASKS[0].samplePrompt, simulatedProvider);
    const c1 = await claimAttempt(db, u, first.attempt.id);
    expect(c1.earned).toBe(first.attempt.reward + first.attempt.bonus);
    expect(c1.user.xp).toBeGreaterThan(0);
    expect(c1.user.currentStreak).toBe(1);
    expect(c1.user.rating).not.toBe(1000);
    await expect(claimAttempt(db, u, first.attempt.id)).rejects.toThrow("Already claimed");
    const again = await runAttempt(db, u, "legal-clause-01", SEED_TASKS[0].samplePrompt, simulatedProvider);
    expect((await claimAttempt(db, u, again.attempt.id)).earned).toBe(0); // same result — no farming
  });

  it("serves task lists, recommendations, dashboard stats and leaderboards", async () => {
    const [u] = [await signUp(db, { email: "dash@example.com", password: "password123" })];
    const a = await runAttempt(db, u, "invoice-extract-02", SEED_TASKS[1].samplePrompt, simulatedProvider);
    await claimAttempt(db, u, a.attempt.id);
    const list = await listTasksForUser(db, u.id);
    expect(list.find((t) => t.id === "invoice-extract-02")?.status).toBe("done");
    expect(list[0]).not.toHaveProperty("rubric");
    expect(list[0]).not.toHaveProperty("simulatedResponse");
    expect((await recommendTask(db, u.id, 1000))?.id).not.toBe("invoice-extract-02");
    const stats = await dashboardStats(db, u.id);
    expect(stats.week).toHaveLength(7);
    expect(stats.attempts).toBe(1);
    const all = await leaderboard(db, { period: "all", currentUserId: u.id });
    expect(all[0].name).toBe("Sharwari Kathole");
    const week = await leaderboard(db, { period: "week", currentUserId: u.id });
    expect(week.some((r) => r.isYou)).toBe(true);
  });
});

describe("local lab", () => {
  it("runs both models, scores them, and aggregates history", async () => {
    const { runLab, labHistory } = await import("@/lib/server/services/lab");
    const { simulatedSmallProvider } = await import("@/lib/server/llm");
    const u = await signUp(db, { email: "lab@example.com", password: "password123" });
    const providers = { cloud: simulatedProvider, local: simulatedSmallProvider };
    const vague = await runLab(db, u, "plan-math-07", "Which plan is cheaper over a year?", providers);
    expect(vague.run.local.costUsd).toBe(0);
    expect(vague.run.cloud.costUsd).toBeGreaterThan(0);
    expect(vague.run.local.taskSuccess).toBeLessThan(vague.run.cloud.taskSuccess); // small model slips on arithmetic
    const careful = await runLab(db, u, "plan-math-07", SEED_TASKS[6].samplePrompt.replace("Show the arithmetic briefly", "Think step by step and show the arithmetic"), providers);
    expect(careful.verdict.kind).toBe("matched"); // explicit reasoning closes the gap
    const h = await labHistory(db, u.id);
    expect(h[0]).toMatchObject({ category: "Reasoning", runs: 2 });
  });
});

describe("team", () => {
  it("groups members by organisation and summarises readiness", async () => {
    const { teamOverview, updateProfile } = await import("@/lib/server/services/team");
    const a = await signUp(db, { email: "t1@acme.com", password: "password123", org: "Acme" });
    const b = await signUp(db, { email: "t2@acme.com", password: "password123" });
    expect(await updateProfile(db, b.id, { org: "ACME" })).toMatchObject({ org: "ACME" });
    const r = await runAttempt(db, a, "invoice-extract-02", SEED_TASKS[1].samplePrompt, simulatedProvider);
    await claimAttempt(db, a, r.attempt.id);
    const t = await teamOverview(db, "acme");
    expect(t?.summary.members).toBe(2);
    expect(t?.summary.activeMembers).toBe(1);
    expect(t?.members[0].tasksCompleted).toBe(1);
    expect(await teamOverview(db, "nobody-org")).toBeNull();
  });
});
