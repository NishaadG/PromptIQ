import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, requireApiUser } from "@/lib/server/http";
import { getTask, toClientTask } from "@/lib/server/services/catalog";

export const GET = handler(async (_req: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) => {
  await requireApiUser();
  const { id } = await ctx.params;
  const task = await getTask(await getDb(), id);
  if (!task) throw new HttpError(404, "Task not found");
  return json({ task: toClientTask(task) });
});
