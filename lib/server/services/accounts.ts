import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().trim().min(1).max(80).optional(),
  org: z.string().trim().max(80).optional(),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export class AccountError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function nameFromEmail(email: string) {
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) || "New learner";
}

async function uniqueHandle(db: DB, base: string) {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "learner";
  for (let i = 0; i < 50; i++) {
    const handle = i === 0 ? root : `${root}${i + 1}`;
    const taken = await db.select({ id: users.id }).from(users).where(eq(users.handle, handle)).limit(1);
    if (!taken.length) return handle;
  }
  return `${root}${randomUUID().slice(0, 6)}`;
}

export async function signUp(db: DB, input: z.infer<typeof signupSchema>) {
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (exists.length) throw new AccountError(409, "An account with this email already exists");
  const name = input.name || nameFromEmail(input.email);
  const [user] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email: input.email,
      name,
      handle: await uniqueHandle(db, input.email.split("@")[0]),
      org: input.org || null,
      passwordHash: await hashPassword(input.password),
    })
    .returning();
  return user;
}

export async function logIn(db: DB, input: z.infer<typeof loginSchema>) {
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, input.email)).limit(1);
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!user || !ok) throw new AccountError(401, "Email or password is incorrect");
  return user;
}
