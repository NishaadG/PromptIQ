import "server-only";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser } from "./dal";
import type { User } from "./db/schema";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const json = (data: unknown, init?: number | ResponseInit) =>
  Response.json(data, typeof init === "number" ? { status: init } : init);

/** Wrap a route handler: maps HttpError/ZodError to JSON error responses, hides internal errors. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
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

/* Simple in-memory fixed-window rate limiter (per instance; good enough to stop brute force). */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  if (++b.count > limit) throw new HttpError(429, "Too many requests — try again shortly");
}

export function clientKey(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
