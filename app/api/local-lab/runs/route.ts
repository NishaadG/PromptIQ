import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, parseBody, rateLimit, requireApiUser } from "@/lib/server/http";
import { AttemptError } from "@/lib/server/services/attempts";
import { labHistory, runLab } from "@/lib/server/services/lab";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ history: await labHistory(await getDb(), user.id) });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await rateLimit(`lab:${user.id}`, 20, 60_000);
  const { taskId, prompt } = await parseBody(req, z.object({ taskId: z.string().min(1), prompt: z.string().min(1).max(8000) }));
  try {
    const { run, verdict } = await runLab(await getDb(), user, taskId, prompt);
    return json({ run: { ...run, createdAt: run.createdAt.toISOString() }, verdict }, 201);
  } catch (e) {
    if (e instanceof AttemptError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
