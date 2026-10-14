import { getDb } from "@/lib/server/db";
import { handler, json, parseBody, requireApiAdmin } from "@/lib/server/http";
import { itemStats, taskInputSchema, upsertTask } from "@/lib/server/services/admin";

/** Full item bank with rubrics and observed statistics. */
export const GET = handler(async () => {
  await requireApiAdmin();
  return json({ items: await itemStats(await getDb()) });
});

/** Create or update a task (validated rubric). */
export const POST = handler(async (req: Request) => {
  await requireApiAdmin();
  const input = await parseBody(req, taskInputSchema);
  return json({ task: await upsertTask(await getDb(), input) }, 201);
});
