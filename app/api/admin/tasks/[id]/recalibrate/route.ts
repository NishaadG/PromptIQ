import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, requireApiAdmin } from "@/lib/server/http";
import { recalibrateTask } from "@/lib/server/services/admin";

/** Replace benchmark medians with observed medians from real learners. */
export const POST = handler(async (_req: NextRequest, ctx: RouteContext<"/api/admin/tasks/[id]/recalibrate">) => {
  await requireApiAdmin();
  const { id } = await ctx.params;
  const r = await recalibrateTask(await getDb(), id);
  if (!r.ok) throw new HttpError(409, r.reason);
  return json({ task: r.task });
});
