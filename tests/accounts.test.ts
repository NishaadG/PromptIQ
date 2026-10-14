import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type DB } from "@/lib/server/db/client";
import { seed } from "@/lib/server/db/seed";
import { DEMO_LOGIN, SEED_TASKS } from "@/lib/server/db/seed-data";
import { attempts, users } from "@/lib/server/db/schema";
import { createSession, getSessionUser } from "@/lib/server/auth/sessions";
import { AccountError, changePassword, deleteAccount, exportAccount, logIn, signUp } from "@/lib/server/services/accounts";
import { runAttempt } from "@/lib/server/services/attempts";
import { simulatedProvider } from "@/lib/server/llm";

let db: DB;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seed(db, { demoUsers: true });
});
afterAll(() => close());

describe("account self-service", () => {
  it("changes the password and signs out every session", async () => {
    const u = await signUp(db, { email: "pw@example.com", password: "password123" });
    const { token } = await createSession(db, u.id);
    await expect(changePassword(db, u, { currentPassword: "wrong-one", newPassword: "newpassword1" })).rejects.toBeInstanceOf(AccountError);
    await changePassword(db, u, { currentPassword: "password123", newPassword: "newpassword1" });
    expect(await getSessionUser(db, token)).toBeNull();
    await expect(logIn(db, { email: "pw@example.com", password: "password123" })).rejects.toBeInstanceOf(AccountError);
    expect((await logIn(db, { email: "pw@example.com", password: "newpassword1" })).id).toBe(u.id);
  });

  it("protects the shared demo account", async () => {
    const demo = await logIn(db, { email: DEMO_LOGIN.email, password: DEMO_LOGIN.password });
    await expect(changePassword(db, demo, { currentPassword: DEMO_LOGIN.password, newPassword: "hijacked123" })).rejects.toThrow(/demo/);
    await expect(deleteAccount(db, demo, DEMO_LOGIN.password)).rejects.toThrow(/demo/);
  });

  it("exports data without secrets, then deletes everything", async () => {
    const u = await signUp(db, { email: "bye@example.com", password: "password123" });
    await runAttempt(db, u, SEED_TASKS[0].id, SEED_TASKS[0].samplePrompt, simulatedProvider);
    const data = await exportAccount(db, u.id);
    expect(data.attempts).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("scrypt$");

    await expect(deleteAccount(db, u, "nope")).rejects.toBeInstanceOf(AccountError);
    await deleteAccount(db, u, "password123");
    expect(await db.select().from(users).where(eq(users.id, u.id))).toHaveLength(0);
    expect(await db.select().from(attempts).where(eq(attempts.userId, u.id))).toHaveLength(0);
  });
});
