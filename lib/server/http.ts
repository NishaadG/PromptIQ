import "server-only";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser } from "./dal";
import { getDb } from "./db";
import { hit } from "./rate-limit";
import type { User } from "./db/schema";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const json = (data: unknown, init?: number | ResponseInit) =>
  Response.json(data, typeof init === "number" ? { status: init } : init);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence in depth (the session cookie is already SameSite=Lax): a state-changing request
 * that carries an Origin header must come from this site's own host.
 */
export function assertSameOrigin(req: Request) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server) don't send Origin
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-site request blocked");
  }
  if (!host || originHost !== host) throw new HttpError(403, "Cross-site request blocked");
}

/** Wrap a route handler: same-origin check, maps HttpError/ZodError to JSON error responses, hides internal errors. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      if (args[0] instanceof Request) assertSameOrigin(args[0]);
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, details: e.details }, e.status);
      if (e instanceof ZodError) return json({ error: "Invalid request", details: e.issues }, 400);
      console.error("[api] unhandled error", e);
      return json({ error: "Internal server error" }, 500);
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
  return schema.parse(body);
}

export async function requireApiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  return user;
}

/** Throw 429 once `key` exceeds `limit` hits per window. Shared across instances via the database. */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const r = await hit(await getDb(), key, limit, windowMs);
  if (!r.ok) {
    const retry = Math.max(1, Math.ceil((r.resetAt.getTime() - Date.now()) / 1000));
    throw new HttpError(429, "Too many requests — try again shortly", { retryAfterSeconds: retry });
  }
}

export function clientKey(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function requireApiAdmin(): Promise<User> {
  const user = await requireApiUser();
  const { isAdmin } = await import("./services/admin");
  if (!isAdmin(user)) throw new HttpError(403, "Admins only");
  return user;
}
