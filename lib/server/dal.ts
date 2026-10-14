/**
 * Data Access Layer: the single place where request auth is resolved (Next.js auth guide pattern).
 * Every Server Component, Route Handler and Server Action that needs the user goes through here.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getSessionUser, SESSION_COOKIE, SESSION_DAYS } from "./auth/sessions";
import type { User } from "./db/schema";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(await getDb(), token);
});

/** For pages: redirect to /login when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export { SESSION_DAYS };

/** Public shape of a user — never send password hashes or internal fields to the client. */
export function toPublicUser(u: User) {
  return {
    id: u.id, name: u.name, handle: u.handle, email: u.email, org: u.org, role: u.role,
    xp: u.xp, tokens: u.tokens, currentStreak: u.currentStreak, longestStreak: u.longestStreak,
    rating: Math.round(u.rating),
  };
}
export type PublicUser = ReturnType<typeof toPublicUser>;
