import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { handler, HttpError, json, parseBody, rateLimit, requireApiUser } from "@/lib/server/http";
import { AttemptError, MAX_PROMPT_CHARS, runAttempt } from "@/lib/server/services/attempts";
import { toClientAttempt } from "@/lib/server/services/present";

const body = z.object({
  prompt: z.string().min(1).max(MAX_PROMPT_CHARS),
  elapsedMs: z.number().int().min(0).max(864e5).optional(),
  pastedChars: z.number().int().min(0).max(1e6).optional(),
});

/** Submit a prompt for a task: runs the model, scores the result, stores an unclaimed attempt. */
export const POST = handler(async (req: NextRequest, ctx: RouteContext<"/api/tasks/[id]/attempts">) => {
  const user = await requireApiUser();
  rateLimit(`attempt:${user.id}`, 30, 60_000);
  const { id } = await ctx.params;
  const { prompt, elapsedMs, pastedChars } = await parseBody(req, body);
  try {
    const { attempt, percentile } = await runAttempt(await getDb(), user, id, prompt, undefined, { elapsedMs, pastedChars });
    return json({ attempt: toClientAttempt(attempt), percentile }, 201);
  } catch (e) {
    if (e instanceof AttemptError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
