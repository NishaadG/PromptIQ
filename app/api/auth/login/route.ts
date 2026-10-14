import { getDb } from "@/lib/server/db";
import { createSession } from "@/lib/server/auth/sessions";
import { setSessionCookie, toPublicUser } from "@/lib/server/dal";
import { clientKey, handler, HttpError, json, parseBody, rateLimit } from "@/lib/server/http";
import { AccountError, logIn, loginSchema } from "@/lib/server/services/accounts";

export const POST = handler(async (req: Request) => {
  rateLimit(`login:${clientKey(req)}`, 20, 15 * 60_000);
  const input = await parseBody(req, loginSchema);
  const db = await getDb();
  try {
    const user = await logIn(db, input);
    const { token, expiresAt } = await createSession(db, user.id);
    await setSessionCookie(token, expiresAt);
    return json({ user: toPublicUser(user) });
  } catch (e) {
    if (e instanceof AccountError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
