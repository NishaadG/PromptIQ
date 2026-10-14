import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type DB } from "@/lib/server/db/client";
import { seed } from "@/lib/server/db/seed";
import { SEED_TASKS } from "@/lib/server/db/seed-data";
import { signUp } from "@/lib/server/services/accounts";
import { claimAttempt, runAttempt } from "@/lib/server/services/attempts";
import { trackProgress } from "@/lib/server/services/certification";
import { flaggedAttempts } from "@/lib/server/services/admin";
import { integritySignals } from "@/lib/scoring/integrity";
import { simulatedProvider } from "@/lib/server/llm";

describe("integrity signals", () => {
  it("flags superhuman typing but not normal drafting or pasted text", () => {
    expect(integritySignals({ promptChars: 600, elapsedMs: 10_000, taskSuccess: 80 }).flags).toContain("implausible_typing_speed");
    expect(integritySignals({ promptChars: 600, elapsedMs: 120_000, taskSuccess: 80 }).flags).toEqual([]);
    // Pasting is legitimate (people reuse their own prompts): informational flag only, no speed flag.
    const pasted = integritySignals({ promptChars: 600, elapsedMs: 2_000, pastedChars: 600, taskSuccess: 80 });
    expect(pasted.flags).toEqual(["mostly_pasted"]);
  });
  it("flags a near-perfect score that the rating model considered very unlikely", () => {
    expect(integritySignals({ promptChars: 50, expectedSuccess: 0.1, taskSuccess: 98 }).flags).toEqual(["sudden_jump"]);
    expect(integritySignals({ promptChars: 50, expectedSuccess: 0.6, taskSuccess: 98 }).flags).toEqual([]);
  });
});

describe("integrity in the attempt flow", () => {
  let db: DB;
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    await seed(db, { demoUsers: false });
  });
  afterAll(() => close());

  it("records flags, surfaces them to admins, and excludes disqualified attempts from certification", async () => {
    const u = await signUp(db, { email: "fast@example.com", password: "password123" });
    const summ = SEED_TASKS.filter((t) => t.category === "Summarization");
    for (const t of summ) {
      const r = await runAttempt(db, u, t.id, t.samplePrompt, simulatedProvider, { elapsedMs: 500, pastedChars: 0 });
      expect(r.attempt.integrity.flags).toContain("implausible_typing_speed");
      await claimAttempt(db, u, r.attempt.id); // practice still pays out
    }
    expect((await trackProgress(db, u.id)).find((t) => t.track === "Summarization")!.eligible).toBe(false);
    expect((await flaggedAttempts(db)).filter((f) => f.handle === u.handle)).toHaveLength(summ.length);

    for (const t of summ) {
      const r = await runAttempt(db, u, t.id, t.samplePrompt, simulatedProvider, { elapsedMs: 5 * 60_000 });
      expect(r.attempt.integrity.flags).not.toContain("implausible_typing_speed");
      await claimAttempt(db, u, r.attempt.id);
    }
    expect((await trackProgress(db, u.id)).find((t) => t.track === "Summarization")!.eligible).toBe(true);
  });
});
