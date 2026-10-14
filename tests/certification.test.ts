import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type DB } from "@/lib/server/db/client";
import { seed } from "@/lib/server/db/seed";
import { SEED_TASKS } from "@/lib/server/db/seed-data";
import { credentials } from "@/lib/server/db/schema";
import { signUp } from "@/lib/server/services/accounts";
import { claimAttempt, runAttempt } from "@/lib/server/services/attempts";
import { CertificationError, issueCredential, trackProgress, verifyCredential } from "@/lib/server/services/certification";
import { canonicalJson, signPayload, verifyPayload } from "@/lib/server/credentials/signing";
import { simulatedProvider } from "@/lib/server/llm";

let db: DB;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seed(db, { demoUsers: false });
});
afterAll(() => close());

describe("signing", () => {
  it("canonical JSON is key-order independent", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonicalJson({ a: [2, { c: 4, d: 3 }], b: 1 }));
  });
  it("detects any change to a signed payload", () => {
    const payload = { id: "X", score: 90 };
    const { signature } = signPayload(payload);
    expect(verifyPayload(payload, signature)).toBe(true);
    expect(verifyPayload({ ...payload, score: 99 }, signature)).toBe(false);
  });
});

describe("certification", () => {
  it("issues a verifiable certificate once a track is passed, and detects tampering", async () => {
    const u = await signUp(db, { email: "cert@example.com", password: "password123" });
    await expect(issueCredential(db, u, "Summarization")).rejects.toBeInstanceOf(CertificationError);

    for (const t of SEED_TASKS.filter((t) => t.category === "Summarization")) {
      const r = await runAttempt(db, u, t.id, t.samplePrompt, simulatedProvider);
      expect(r.attempt.taskSuccess).toBeGreaterThanOrEqual(85);
      await claimAttempt(db, u, r.attempt.id);
    }
    const track = (await trackProgress(db, u.id)).find((t) => t.track === "Summarization")!;
    expect(track.eligible).toBe(true);

    const cred = await issueCredential(db, u, "Summarization");
    expect(cred.id).toMatch(/^PIQ-SUM-\d{4}-[0-9A-F]{8}$/);
    expect((await verifyCredential(db, cred.id)).status).toBe("valid");
    await expect(issueCredential(db, u, "Summarization")).rejects.toThrow(/already hold/);

    await db.update(credentials).set({ score: cred.score === 100 ? 50 : 100 }).where(eq(credentials.id, cred.id)); // forge the record
    expect((await verifyCredential(db, cred.id)).status).toBe("tampered");
    expect((await verifyCredential(db, "PIQ-NOPE")).status).toBe("not_found");
  });
});
