import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, parseBody, requireApiAdmin } from "@/lib/server/http";
import { AgentError, integrityReviewer, listRuns, runAgent } from "@/lib/server/agents";

/** Recent agent runs across the platform, newest first. */
export const GET = handler(async () => {
  await requireApiAdmin();
  return json({ runs: await listRuns(await getDb(), { limit: 50 }) });
});

/** Ask the Integrity Reviewer to prepare a proposal on a flagged attempt. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiAdmin();
  const input = await parseBody(req, z.object({ attemptId: z.string().min(1).max(64) }));
  try {
    const { run, output } = await runAgent(integrityReviewer, { db: await getDb(), user, input });
    return json({ runId: run.id, status: run.status, proposal: output }, 201);
  } catch (e) {
    if (e instanceof AgentError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
