import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "../db/client";
import { attempts, credentials, labRuns, users, type User } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";
import { deleteUserSessions } from "../auth/sessions";

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

/* ------------------------------------------------------------------ account self-service */

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: signupSchema.shape.password,
});
export const confirmPasswordSchema = z.object({ password: z.string().min(1) });

async function confirmPassword(db: DB, user: User, password: string) {
  if (user.isDemo) throw new AccountError(403, "The shared demo account can't be changed — sign up for your own account");
  const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!fresh || !(await verifyPassword(password, fresh.passwordHash))) throw new AccountError(401, "Current password is incorrect");
}

/** Change password and revoke every existing session; the caller issues a fresh one. */
export async function changePassword(db: DB, user: User, input: z.infer<typeof passwordChangeSchema>) {
  await confirmPassword(db, user, input.currentPassword);
  await db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, user.id));
  await deleteUserSessions(db, user.id);
}

/** Permanently delete the account; attempts, sessions, lab runs and certificates cascade. */
export async function deleteAccount(db: DB, user: User, password: string) {
  await confirmPassword(db, user, password);
  await db.delete(users).where(eq(users.id, user.id));
}

/** Everything stored about a user, as portable JSON (no password hash, no session tokens). */
export async function exportAccount(db: DB, userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new AccountError(404, "Account not found");
  const { passwordHash: _hash, ...profile } = u;
  const [userAttempts, userCredentials, userLabRuns] = await Promise.all([
    db.select().from(attempts).where(eq(attempts.userId, userId)).orderBy(asc(attempts.createdAt)),
    db.select().from(credentials).where(eq(credentials.userId, userId)),
    db.select().from(labRuns).where(eq(labRuns.userId, userId)).orderBy(asc(labRuns.createdAt)),
  ]);
  return { exportedAt: new Date().toISOString(), profile, attempts: userAttempts, credentials: userCredentials, labRuns: userLabRuns };
}
