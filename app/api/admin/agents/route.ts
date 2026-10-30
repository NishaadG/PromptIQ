import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, parseBody, requireApiAdmin } from "@/lib/server/http";
import { AgentError, integrityReviewer, listRuns, runAgent, taskAuthor } from "@/lib/server/agents";

/** Recent agent runs across the platform, newest first. */
export const GET = handler(async () => {
  await requireApiAdmin();
  return json({ runs: await listRuns(await getDb(), { limit: 50 }) });
});

const body = z.discriminatedUnion("agent", [
  z.object({ agent: z.literal("integrity_reviewer"), attemptId: z.string().min(1).max(64) }),
  z.object({ agent: z.literal("task_author"), draft: z.unknown() }),
]);

/** Start an admin agent: the Integrity Reviewer on a flagged attempt, or the Task Author on a draft task. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiAdmin();
  const input = await parseBody(req, body);
  const db = await getDb();
  try {
    const { run, output } = input.agent === "task_author"
      ? await runAgent(taskAuthor, { db, user, input: { draft: input.draft } })
      : await runAgent(integrityReviewer, { db, user, input: { attemptId: input.attemptId } });
    return json({ runId: run.id, status: run.status, proposal: output }, 201);
  } catch (e) {
    if (e instanceof AgentError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
