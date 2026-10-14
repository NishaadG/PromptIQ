import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, parseBody, requireApiAdmin } from "@/lib/server/http";
import { setTaskActive } from "@/lib/server/services/admin";

/** Activate / retire a task (retired tasks keep their attempts and certificates intact). */
export const PATCH = handler(async (req: NextRequest, ctx: RouteContext<"/api/admin/tasks/[id]">) => {
  await requireApiAdmin();
  const { id } = await ctx.params;
  const { active } = await parseBody(req, z.object({ active: z.boolean() }));
  const task = await setTaskActive(await getDb(), id, active);
  if (!task) throw new HttpError(404, "Task not found");
  return json({ task });
});
