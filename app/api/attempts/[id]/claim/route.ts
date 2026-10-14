import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { toPublicUser } from "@/lib/server/dal";
import { handler, HttpError, json, requireApiUser } from "@/lib/server/http";
import { AttemptError, claimAttempt } from "@/lib/server/services/attempts";

export const POST = handler(async (_req: NextRequest, ctx: RouteContext<"/api/attempts/[id]/claim">) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  try {
    const { earned, xpGain, user: updated } = await claimAttempt(await getDb(), user, id);
    return json({ earned, xpGain, user: toPublicUser(updated) });
  } catch (e) {
    if (e instanceof AttemptError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
