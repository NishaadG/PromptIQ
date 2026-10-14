/**
 * Certification: a learner earns a signed credential for a track (task category) once they have a
 * claimed attempt scoring ≥ PASS on every active task in that track. Credentials expire after
 * VALID_MONTHS and are verifiable by anyone via the public page or the signature + public key.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { attempts, credentials, tasks, users, type User } from "../db/schema";
import { signPayload, verifyPayload } from "../credentials/signing";

export const PASS_SCORE = 85;
export const VALID_MONTHS = 24;

export class CertificationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function levelFor(avg: number): "Foundational" | "Practitioner" | "Expert" {
  return avg >= 95 ? "Expert" : avg >= 90 ? "Practitioner" : "Foundational";
}

/** Per track: how many tasks are passed (best claimed score ≥ PASS) and whether it is certifiable. */
export async function trackProgress(db: DB, userId: string) {
  const rows = await db
    .select({
      track: tasks.category, taskId: tasks.id,
      best: sql<number | null>`max(${attempts.taskSuccess}) filter (where ${attempts.claimed})`,
    })
    .from(tasks)
    .leftJoin(attempts, and(eq(attempts.taskId, tasks.id), eq(attempts.userId, userId)))
    .where(eq(tasks.active, true))
    .groupBy(tasks.category, tasks.id);
  const byTrack = new Map<string, { total: number; passed: number; scores: number[] }>();
  for (const r of rows) {
    const t = byTrack.get(r.track) ?? { total: 0, passed: 0, scores: [] };
    t.total++;
    const best = r.best === null ? null : Number(r.best);
    if (best !== null && best >= PASS_SCORE) {
      t.passed++;
      t.scores.push(best);
    }
    byTrack.set(r.track, t);
  }
  const held = await db.select().from(credentials).where(and(eq(credentials.userId, userId), eq(credentials.revoked, false)));
  return [...byTrack.entries()].map(([track, t]) => {
    const current = held.filter((c) => c.track === track && c.expiresAt > new Date()).sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())[0];
    const avg = t.scores.length ? Math.round(t.scores.reduce((s, x) => s + x, 0) / t.scores.length) : 0;
    return { track, total: t.total, passed: t.passed, eligible: t.passed === t.total, avgScore: avg, level: levelFor(avg), credentialId: current?.id ?? null };
  });
}

function newCredentialId(track: string) {
  const code = track.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  return `PIQ-${code}-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function issueCredential(db: DB, user: User, track: string) {
  const progress = (await trackProgress(db, user.id)).find((p) => p.track === track);
  if (!progress) throw new CertificationError(404, "Unknown track");
  if (!progress.eligible) throw new CertificationError(409, `Pass all ${progress.total} ${track} tasks at ${PASS_SCORE}+ first (${progress.passed} done)`);
  if (progress.credentialId) throw new CertificationError(409, "You already hold a valid certificate for this track");

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + VALID_MONTHS);
  const id = newCredentialId(track);
  // The payload is exactly what gets signed — and what a verifier re-serializes.
  const payload = {
    type: "PromptIQCertificate", version: 1, id, track, level: progress.level, score: progress.avgScore,
    holder: { name: user.name, handle: user.handle }, issuer: "PromptIQ",
    issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  };
  const { signature, keyId } = signPayload(payload);
  const [row] = await db
    .insert(credentials)
    .values({ id, userId: user.id, track, level: progress.level, score: progress.avgScore, issuedAt, expiresAt, payload, signature, keyId })
    .returning();
  return row;
}

export type VerificationResult =
  | { status: "valid" | "expired" | "revoked" | "tampered"; credential: { id: string; track: string; level: string; score: number; holder: string; issuedAt: string; expiresAt: string; keyId: string } }
  | { status: "not_found" };

export async function verifyCredential(db: DB, id: string): Promise<VerificationResult> {
  const [c] = await db.select().from(credentials).where(eq(credentials.id, id)).limit(1);
  if (!c) return { status: "not_found" };
  const [holder] = await db.select({ name: users.name }).from(users).where(eq(users.id, c.userId)).limit(1);
  const credential = {
    id: c.id, track: c.track, level: c.level, score: c.score, holder: holder?.name ?? "Unknown",
    issuedAt: c.issuedAt.toISOString(), expiresAt: c.expiresAt.toISOString(), keyId: c.keyId,
  };
  // Signature check guards against database tampering: stored columns must match the signed payload.
  const p = c.payload as Record<string, unknown>;
  const consistent = p.id === c.id && p.track === c.track && p.level === c.level && p.score === c.score;
  if (!consistent || !verifyPayload(p, c.signature)) return { status: "tampered", credential };
  if (c.revoked) return { status: "revoked", credential };
  if (c.expiresAt < new Date()) return { status: "expired", credential };
  return { status: "valid", credential };
}

export async function listCredentials(db: DB, userId: string) {
  return db.select().from(credentials).where(eq(credentials.userId, userId)).orderBy(desc(credentials.issuedAt));
}
