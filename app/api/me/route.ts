import { getDb } from "@/lib/server/db";
import { toPublicUser } from "@/lib/server/dal";
import { handler, json, parseBody, requireApiUser } from "@/lib/server/http";
import { profileUpdateSchema, updateProfile } from "@/lib/server/services/team";

export const GET = handler(async () => json({ user: toPublicUser(await requireApiUser()) }));

/** Update display name and organisation. */
export const PATCH = handler(async (req: Request) => {
  const user = await requireApiUser();
  const input = await parseBody(req, profileUpdateSchema);
  const updated = await updateProfile(await getDb(), user.id, input);
  return json({ user: toPublicUser(updated ?? user) });
});
