import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, parseBody, rateLimit, requireApiUser } from "@/lib/server/http";
import { AgentError, curriculumPlanner, promptOptimiser, runAgent, tutor } from "@/lib/server/agents";

const attemptInput = z.object({ attemptId: z.string().min(1).max(64) });

/** Learner-facing agents: POST /api/agents/tutor | optimiser | planner. */
export const POST = handler(async (req: NextRequest, ctx: RouteContext<"/api/agents/[agent]">) => {
  const user = await requireApiUser();
  await rateLimit(`agents:${user.id}`, 20, 60_000);
  const { agent } = await ctx.params;
  const db = await getDb();
  try {
    if (agent === "tutor") {
      const { run, output } = await runAgent(tutor, { db, user, input: await parseBody(req, attemptInput) });
      return json({ runId: run.id, hint: output });
    }
    if (agent === "optimiser") {
      const { run, output } = await runAgent(promptOptimiser, { db, user, input: await parseBody(req, attemptInput) });
      return json({ runId: run.id, result: output });
    }
    if (agent === "planner") {
      const { run, output } = await runAgent(curriculumPlanner, { db, user, input: {} });
      return json({ runId: run.id, plan: output });
    }
  } catch (e) {
    if (e instanceof AgentError) throw new HttpError(e.status, e.message);
    throw e;
  }
  throw new HttpError(404, "Unknown agent");
});
