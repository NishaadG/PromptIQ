import { getDb } from "@/lib/server/db";
import { clearSessionCookie, toPublicUser } from "@/lib/server/dal";
import { handler, HttpError, json, parseBody, rateLimit, requireApiUser } from "@/lib/server/http";
import { AccountError, confirmPasswordSchema, deleteAccount } from "@/lib/server/services/accounts";
import { profileUpdateSchema, updateProfile } from "@/lib/server/services/team";

export const GET = handler(async () => json({ user: toPublicUser(await requireApiUser()) }));

/** Update display name and organisation. */
export const PATCH = handler(async (req: Request) => {
  const user = await requireApiUser();
  const input = await parseBody(req, profileUpdateSchema);
  const updated = await updateProfile(await getDb(), user.id, input);
  return json({ user: toPublicUser(updated ?? user) });
});

/** Permanently delete your account (password required). Certificates stop verifying. */
export const DELETE = handler(async (req: Request) => {
  const user = await requireApiUser();
  rateLimit(`delete:${user.id}`, 10, 15 * 60_000);
  const { password } = await parseBody(req, confirmPasswordSchema);
  try {
    await deleteAccount(await getDb(), user, password);
  } catch (e) {
    if (e instanceof AccountError) throw new HttpError(e.status, e.message);
    throw e;
  }
  await clearSessionCookie();
  return json({ ok: true });
});
