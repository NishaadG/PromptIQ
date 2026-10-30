import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { createTestDb, type DB } from "@/lib/server/db/client";
import { seed } from "@/lib/server/db/seed";
import { SEED_TASKS } from "@/lib/server/db/seed-data";
import { agentRuns, attempts } from "@/lib/server/db/schema";
import { signUp } from "@/lib/server/services/accounts";
import { claimAttempt, runAttempt } from "@/lib/server/services/attempts";
import { simulatedProvider } from "@/lib/server/llm";
import { AgentError, curriculumPlanner, decideRun, integrityReviewer, promptOptimiser, runAgent, tutor } from "@/lib/server/agents";
import type { AgentDef } from "@/lib/server/agents/core";

let db: DB;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seed(db);
});
afterAll(() => close());

const LAZY = "Help with this.";
const user = (email: string) => signUp(db, { email, password: "password123" });

describe("orchestrator safeguards", () => {
  const echo = { description: "echo", run: async (_: unknown, i: unknown) => i };
  const base = { name: "tutor" as const, goal: "test", tools: { echo }, maxSteps: 3, maxTokens: 100, subjectOf: () => null, finalize: (_: unknown, f: unknown) => f };

  it("refuses tools that are not on the agent's allow-list, and logs the failed run", async () => {
    const u = await user("allow@example.com");
    const rogue: AgentDef<object, unknown> = { ...base, policy: () => ({ tool: "delete_everything", input: {} }) };
    await expect(runAgent(rogue, { db, user: u, input: {} })).rejects.toThrow(/not on the tutor allow-list/);
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.userId, u.id));
    expect(run.status).toBe("failed");
  });

  it("stops a run that exceeds its step or token budget", async () => {
    const u = await user("budget@example.com");
    const loop: AgentDef<object, unknown> = { ...base, policy: () => ({ tool: "echo", input: 1 }) };
    await expect(runAgent(loop, { db, user: u, input: {} })).rejects.toThrow(/Step budget of 3/);
    const spender: AgentDef<object, unknown> = {
      ...base, tools: { spend: { description: "spend", run: async (ctx: { spend(n: number): void }) => ctx.spend(500) } },
      policy: () => ({ tool: "spend", input: {} }),
    };
    await expect(runAgent(spender, { db, user: u, input: {} })).rejects.toThrow(/Token budget of 100/);
  });
});

describe("AI Tutor", () => {
  it("climbs the hint ladder without ever writing the prompt", async () => {
    const u = await user("tutee@example.com");
    const { attempt } = await runAttempt(db, u, "invoice-extract-02", LAZY, simulatedProvider);
    const hints = [];
    for (let i = 0; i < 4; i++) hints.push((await runAgent(tutor, { db, user: u, input: { attemptId: attempt.id } })).output);
    expect(hints.map((h) => h.level)).toEqual([1, 2, 3, 3]);
    expect(hints[0].technique).toBeNull();
    expect(hints[0].focus).toBe("Returns valid JSON with the correct total, count and currency"); // highest-weight miss
    expect(hints[1].technique?.id).toBe("structured");
    expect(hints[2].pattern).toMatch(/JSON/);
    const all = JSON.stringify(hints);
    expect(all).not.toContain(SEED_TASKS[1].samplePrompt.slice(0, 60));
  });

  it("only coaches the learner's own attempts", async () => {
    const a = await user("owner@example.com");
    const b = await user("other@example.com");
    const { attempt } = await runAttempt(db, a, "legal-clause-01", LAZY, simulatedProvider);
    await expect(runAgent(tutor, { db, user: b, input: { attemptId: attempt.id } })).rejects.toBeInstanceOf(AgentError);
  });

  it("switches to efficiency once every criterion passes", async () => {
    const u = await user("ace@example.com");
    const { attempt } = await runAttempt(db, u, "legal-clause-01", SEED_TASKS[0].samplePrompt, simulatedProvider);
    const { output } = await runAgent(tutor, { db, user: u, input: { attemptId: attempt.id } });
    expect(output.focus).toBe("efficiency");
  });
});

describe("Prompt Optimiser", () => {
  it("improves lazy prompts, explains the changes and creates no attempts", async () => {
    const u = await user("optimise@example.com");
    let improved = 0;
    for (const t of SEED_TASKS) {
      const { attempt } = await runAttempt(db, u, t.id, LAZY, simulatedProvider);
      const [{ n: before }] = await db.select({ n: count() }).from(attempts).where(eq(attempts.userId, u.id));
      const { run, output } = await runAgent(promptOptimiser, { db, user: u, input: { attemptId: attempt.id } });
      const [{ n: after }] = await db.select({ n: count() }).from(attempts).where(eq(attempts.userId, u.id));
      expect(after).toBe(before);
      expect(output.optimised.taskSuccess).toBeGreaterThanOrEqual(output.original.taskSuccess);
      if (output.improved) {
        improved++;
        expect(output.changes.length).toBeGreaterThan(0);
        expect(output.optimised.pes).toBeGreaterThan(output.original.pes);
      }
      expect(run.steps.length).toBeGreaterThanOrEqual(3);
    }
    expect(improved).toBeGreaterThanOrEqual(8);
  });
});

describe("Curriculum Planner", () => {
  it("plans up to three unfinished tasks with reasons", async () => {
    const u = await user("planner@example.com");
    const r = await runAttempt(db, u, "invoice-extract-02", SEED_TASKS[1].samplePrompt, simulatedProvider);
    await claimAttempt(db, u, r.attempt.id);
    const { output } = await runAgent(curriculumPlanner, { db, user: u, input: {} });
    expect(output.items).toHaveLength(3);
    expect(output.items.map((i) => i.taskId)).not.toContain("invoice-extract-02");
    for (const i of output.items) expect(i.reason).toMatch(/expected/);
  });
});

describe("Integrity Reviewer", () => {
  it("proposes, waits for approval, and only then changes certification evidence", async () => {
    const admin = await user("admin-agents@example.com");
    const u = await user("fast@example.com");
    const prompt = `${SEED_TASKS[0].samplePrompt} Please be precise and keep the wording simple for the reader.`;
    const { attempt } = await runAttempt(db, u, "legal-clause-01", prompt, simulatedProvider, { elapsedMs: 2000, pastedChars: 0 });
    expect(attempt.integrity.flags).toContain("implausible_typing_speed");

    const { run, output } = await runAgent(integrityReviewer, { db, user: admin, input: { attemptId: attempt.id } });
    expect(run.status).toBe("awaiting_approval");
    expect(output.recommendation).toBe("exclude");
    let [a] = await db.select().from(attempts).where(eq(attempts.id, attempt.id));
    expect(a.integrity.review).toBeUndefined(); // nothing applied yet

    const decided = await decideRun(db, admin, integrityReviewer, run.id, true);
    expect(decided).toMatchObject({ status: "approved", decidedBy: admin.id });
    [a] = await db.select().from(attempts).where(eq(attempts.id, attempt.id));
    expect(a.integrity.review).toMatchObject({ decision: "exclude", runId: run.id, by: admin.id });
    await expect(decideRun(db, admin, integrityReviewer, run.id, false)).rejects.toThrow(/not awaiting approval/);
  });

  it("recommends clearing a sample prompt inserted with the platform's own button", async () => {
    const admin = await user("admin2-agents@example.com");
    const u = await user("sample@example.com");
    const t = SEED_TASKS[0];
    const { attempt } = await runAttempt(db, u, t.id, t.samplePrompt, simulatedProvider, { elapsedMs: 5000, pastedChars: t.samplePrompt.length });
    const { run, output } = await runAgent(integrityReviewer, { db, user: admin, input: { attemptId: attempt.id } });
    expect(output.recommendation).toBe("clear");
    await decideRun(db, admin, integrityReviewer, run.id, false);
    const [a] = await db.select().from(attempts).where(eq(attempts.id, attempt.id));
    expect(a.integrity.review).toBeUndefined(); // rejected proposals change nothing
  });
});
