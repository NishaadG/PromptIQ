import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, parseBody, requireApiUser } from "@/lib/server/http";
import { CertificationError, issueCredential, listCredentials, trackProgress } from "@/lib/server/services/certification";

export const GET = handler(async () => {
  const user = await requireApiUser();
  const db = await getDb();
  const [tracks, held] = await Promise.all([trackProgress(db, user.id), listCredentials(db, user.id)]);
  return json({ tracks, credentials: held.map(({ payload, signature, ...c }) => ({ ...c, verifyUrl: `/verify/${c.id}`, signature })) });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  const { track } = await parseBody(req, z.object({ track: z.string().min(1).max(80) }));
  try {
    const c = await issueCredential(await getDb(), user, track);
    return json({ credential: { id: c.id, track: c.track, level: c.level, score: c.score, expiresAt: c.expiresAt, verifyUrl: `/verify/${c.id}` } }, 201);
  } catch (e) {
    if (e instanceof CertificationError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
