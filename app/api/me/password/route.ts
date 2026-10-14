import { getDb } from "@/lib/server/db";
import { createSession } from "@/lib/server/auth/sessions";
import { setSessionCookie } from "@/lib/server/dal";
import { handler, HttpError, json, parseBody, rateLimit, requireApiUser } from "@/lib/server/http";
import { AccountError, changePassword, passwordChangeSchema } from "@/lib/server/services/accounts";

/** Change password. Signs out every other device and issues this browser a fresh session. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  rateLimit(`password:${user.id}`, 10, 15 * 60_000);
  const input = await parseBody(req, passwordChangeSchema);
  const db = await getDb();
  try {
    await changePassword(db, user, input);
  } catch (e) {
    if (e instanceof AccountError) throw new HttpError(e.status, e.message);
    throw e;
  }
  const { token, expiresAt } = await createSession(db, user.id);
  await setSessionCookie(token, expiresAt);
  return json({ ok: true });
});
