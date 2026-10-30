import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { agentRuns } from "@/lib/server/db/schema";
import { handler, HttpError, json, parseBody, requireApiAdmin } from "@/lib/server/http";
import { AgentError, APPROVAL_AGENTS, decideRun } from "@/lib/server/agents";

/** Approve (and apply) or reject an agent's proposal. */
export const POST = handler(async (req: NextRequest, ctx: RouteContext<"/api/admin/agents/[id]">) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  const { approve } = await parseBody(req, z.object({ approve: z.boolean() }));
  const db = await getDb();
  const [run] = await db.select({ agent: agentRuns.agent }).from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
  const def = run && APPROVAL_AGENTS[run.agent];
  if (!def) throw new HttpError(404, "No proposal with that id");
  try {
    return json({ run: await decideRun(db, admin, def, id, approve) });
  } catch (e) {
    if (e instanceof AgentError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
