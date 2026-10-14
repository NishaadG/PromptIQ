import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type DB } from "@/lib/server/db/client";
import { seed } from "@/lib/server/db/seed";
import { SEED_TASKS } from "@/lib/server/db/seed-data";
import type { Task } from "@/lib/server/db/schema";
import { isAdmin, itemStats, recalibrateTask, setTaskActive, taskInputSchema, upsertTask } from "@/lib/server/services/admin";
import { listTasksForUser } from "@/lib/server/services/catalog";
import { signUp } from "@/lib/server/services/accounts";
import { runAttempt } from "@/lib/server/services/attempts";
import { scoreAttempt } from "@/lib/scoring";
import { simulatedProvider } from "@/lib/server/llm";

let db: DB;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seed(db, { demoUsers: false });
});
afterAll(() => close());

describe("item bank quality gate", () => {
  it.each(SEED_TASKS.map((t) => [t.id, t] as const))("%s validates and its reference answer scores 100", (_id, t) => {
    expect(taskInputSchema.safeParse(t).success).toBe(true);
    const s = scoreAttempt({ task: t as unknown as Task, prompt: t.samplePrompt, response: t.simulatedResponse, promptTokens: 100, outputTokens: 50 });
    expect(s.criteria.filter((c) => !c.passed).map((c) => c.label)).toEqual([]);
  });
});

describe("admin", () => {
  it("recognises admins by role or ADMIN_EMAILS", () => {
    expect(isAdmin({ role: "admin", email: "a@x.com" })).toBe(true);
    expect(isAdmin({ role: "learner", email: "a@x.com" })).toBe(false);
    process.env.ADMIN_EMAILS = "boss@x.com";
    expect(isAdmin({ role: "learner", email: "Boss@x.com" })).toBe(true);
    delete process.env.ADMIN_EMAILS;
  });

  it("rejects invalid rubrics", () => {
    const base = { ...SEED_TASKS[0] };
    expect(taskInputSchema.safeParse({ ...base, rubric: [{ kind: "regex", label: "x", pattern: "(", weight: 1 }] }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, rubric: [] }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, id: "Bad Slug!" }).success).toBe(false);
  });

  it("creates, retires and recalibrates tasks", async () => {
    const input = taskInputSchema.parse({ ...SEED_TASKS[4], id: "custom-task-99", title: "A custom task" });
    const created = await upsertTask(db, input);
    expect(created.number).toBeGreaterThan(Math.max(...SEED_TASKS.map((t) => t.number)));
    const u = await signUp(db, { email: "adm@example.com", password: "password123" });
    expect((await listTasksForUser(db, u.id)).some((t) => t.id === "custom-task-99")).toBe(true);
    await setTaskActive(db, "custom-task-99", false);
    expect((await listTasksForUser(db, u.id)).some((t) => t.id === "custom-task-99")).toBe(false);

    expect((await recalibrateTask(db, "legal-clause-01")).ok).toBe(false); // not enough data yet
    for (let i = 0; i < 10; i++) await runAttempt(db, u, "legal-clause-01", SEED_TASKS[0].samplePrompt, simulatedProvider);
    const r = await recalibrateTask(db, "legal-clause-01");
    expect(r.ok).toBe(true);
    const stats = (await itemStats(db)).find((s) => s.task.id === "legal-clause-01")!;
    expect(stats.attempts).toBe(10);
    if (r.ok) expect(r.task.medianScore).toBe(stats.observedMedianScore);
  });
});
