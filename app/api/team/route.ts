import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, requireApiUser } from "@/lib/server/http";
import { teamOverview } from "@/lib/server/services/team";

/** The signed-in learner's organisation: members and AI-readiness summary. */
export const GET = handler(async () => {
  const user = await requireApiUser();
  if (!user.org) throw new HttpError(404, "Set your organisation on your profile to see your team");
  return json(await teamOverview(await getDb(), user.org));
});
