import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type DB } from "@/lib/server/db/client";
import { seed } from "@/lib/server/db/seed";
import { SEED_TASKS } from "@/lib/server/db/seed-data";
import { signUp } from "@/lib/server/services/accounts";
import { runAttempt } from "@/lib/server/services/attempts";
import { runLab } from "@/lib/server/services/lab";
import { simulatedProvider, simulatedSmallProvider, type LlmProvider } from "@/lib/server/llm";
import { gatePrompt, redact, scanSensitive } from "@/lib/server/privacy";
import { route } from "@/lib/server/router";
import { pesComponents, pesGated, pesLinear } from "@/lib/scoring/pes";

let db: DB;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seed(db);
});
afterAll(() => close());

describe("privacy scanner", () => {
  it("finds personal data and secrets without flagging ordinary numbers", () => {
    const kinds = (s: string) => scanSensitive(s).map((f) => f.kind);
    expect(kinds("Mail asha.k@example.com or call +91 98765 43210")).toEqual(["email", "phone"]);
    expect(kinds("Card 4111 1111 1111 1111, server 10.0.0.12")).toEqual(["card", "ip"]);
    expect(kinds("key sk-proj-abcdefghijklmnopqrstuvwxyz123456")).toEqual(["api_key"]);
    expect(kinds("PAN ABCDE1234F, Aadhaar 2345 6789 0123")).toEqual(["pan", "aadhaar"]);
    expect(kinds("INV-1042 ($1,250.00) on 2026-10-30, 1,500 calls a month, order 1234567890123")).toEqual([]);
  });

  it("masks values in previews and redaction", () => {
    const [f] = scanSensitive("contact asha@example.com");
    expect(f.preview).toBe("a***@example.com");
    expect(redact("Email asha@example.com, phone 9876543210.")).toBe("Email [EMAIL], phone [PHONE].");
  });

  it("blocks secrets everywhere and masks personal data only for external models", () => {
    expect(gatePrompt("use password: hunter2hunter2hunter2", { external: false }).ok).toBe(false);
    const local = gatePrompt("reply to asha@example.com", { external: false });
    const cloud = gatePrompt("reply to asha@example.com", { external: true });
    expect(local.ok && local.text).toBe("reply to asha@example.com");
    expect(cloud.ok && cloud.text).toBe("reply to [EMAIL]");
  });
});

describe("routing engine", () => {
  const budget = 0.003;
  it("prefers the local model when it matches the cloud on quality", () => {
    const r = route([
      { id: "local", taskSuccess: 100, costUsd: 0, latencyMs: 1500, external: false },
      { id: "cloud", taskSuccess: 100, costUsd: 0.002, latencyMs: 1000, external: true },
    ], { personalData: false, budgetCostUsd: budget });
    expect(r.pick).toBe("local");
  });
  it("pays for the cloud when the quality gap is large, unless personal data is involved", () => {
    const c = [
      { id: "local" as const, taskSuccess: 60, costUsd: 0, latencyMs: 1500, external: false },
      { id: "cloud" as const, taskSuccess: 100, costUsd: 0.002, latencyMs: 1000, external: true },
    ];
    expect(route(c, { personalData: false, budgetCostUsd: budget }).pick).toBe("cloud");
    const close = [{ ...c[0], taskSuccess: 85 }, c[1]];
    expect(route(close, { personalData: false, budgetCostUsd: budget }).pick).toBe("cloud");
    expect(route(close, { personalData: true, budgetCostUsd: budget }).pick).toBe("local");
  });
});

describe("prompt efficiency score", () => {
  it("gating stops a cheap failed prompt from outscoring a good one", () => {
    const base = { latencyMs: 1000, medianTokens: 300, referenceCostUsd: 0.0015 };
    const good = pesComponents({ ...base, clarity: 83, taskSuccess: 100, totalTokens: 400, costUsd: 0.002 });
    const lazy = pesComponents({ ...base, clarity: 78, taskSuccess: 40, totalTokens: 150, costUsd: 0.00075 });
    expect(pesGated(good)).toBeGreaterThan(pesGated(lazy));
    expect(pesLinear(lazy)).toBeGreaterThan(pesGated(lazy));
    expect(pesComponents({ ...base, clarity: 80, taskSuccess: 90, totalTokens: 300, costUsd: 0 }).c).toBe(1);
  });
});

describe("gateway in the attempt and Lab flows", () => {
  it("refuses a prompt containing an API key", async () => {
    const u = await signUp(db, { email: "keys@example.com", password: "password123" });
    await expect(runAttempt(db, u, "legal-clause-01", "Summarise this. My key is sk-abcdefghijklmnopqrstuvwxyz0123", simulatedProvider))
      .rejects.toThrow(/API key/);
  });

  it("masks personal data before it reaches an external model and tells the learner", async () => {
    const seen: string[] = [];
    const external: LlmProvider = {
      name: "openai",
      async complete(input) {
        seen.push(input.user);
        return simulatedProvider.complete(input).then((c) => ({ ...c, provider: "openai" }));
      },
    };
    const u = await signUp(db, { email: "pii@example.com", password: "password123" });
    const r = await runAttempt(db, u, "legal-clause-01", `${SEED_TASKS[0].samplePrompt}\nSend questions to priya.n@example.com.`, external);
    expect(seen[0]).toContain("[EMAIL]");
    expect(seen[0]).not.toContain("priya.n@example.com");
    expect(r.attempt.prompt).toContain("priya.n@example.com"); // the learner's own record is unchanged
    expect(r.attempt.feedback[0]).toMatchObject({ kind: "warn" });
  });

  it("keeps the invoice task local because its source text holds email addresses", async () => {
    const u = await signUp(db, { email: "route@example.com", password: "password123" });
    const providers = { cloud: simulatedProvider, local: simulatedSmallProvider };
    const invoice = await runLab(db, u, "invoice-extract-02", SEED_TASKS[1].samplePrompt, providers);
    expect(invoice.privacy.personalData).toBe(true);
    expect(invoice.routing.pick).toBe("local");
    const vague = await runLab(db, u, "plan-math-07", "Which plan is cheaper over a year?", providers);
    expect(vague.routing.pick).toBe("cloud"); // the small model slips on arithmetic here
  });
});
