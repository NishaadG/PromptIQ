import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type DB } from "@/lib/server/db/client";
import { hit } from "@/lib/server/rate-limit";

let db: DB;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

describe("rate limiter", () => {
  it("allows up to the limit, then blocks, per key", async () => {
    for (let i = 1; i <= 3; i++) expect((await hit(db, "login:1.2.3.4", 3, 60_000)).ok).toBe(true);
    expect((await hit(db, "login:1.2.3.4", 3, 60_000)).ok).toBe(false);
    expect((await hit(db, "login:5.6.7.8", 3, 60_000)).ok).toBe(true);
  });
  it("starts a new window once the old one expires", async () => {
    await hit(db, "k", 1, 50);
    expect((await hit(db, "k", 1, 50)).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 80));
    const r = await hit(db, "k", 1, 50);
    expect(r).toMatchObject({ ok: true, count: 1 });
  });
});
