/**
 * Model-graded rubric criteria (`llm_judge`). Only used when a real model is configured; with the
 * offline simulator these criteria are skipped and the remaining weights are renormalised.
 */
import type { RubricCriterion } from "./db/schema";
import type { LlmProvider } from "./llm";

const JUDGE_SYSTEM =
  "You are a strict grader. Answer the question about the RESPONSE with a single word: YES or NO. " +
  "Judge only what is in the response; do not reward effort or length.";

export async function judgeCriteria(
  provider: LlmProvider,
  criteria: RubricCriterion[],
  ctx: { brief: string; response: string },
): Promise<Record<string, boolean>> {
  const judged: Record<string, boolean> = {};
  if (provider.name.startsWith("simulated")) return judged;
  for (const c of criteria) {
    if (c.kind !== "llm_judge") continue;
    try {
      const out = await provider.complete({
        system: JUDGE_SYSTEM,
        user: `TASK BRIEF:\n${ctx.brief}\n\nRESPONSE:\n${ctx.response}\n\nQUESTION: ${c.question}\nAnswer YES or NO.`,
        maxTokens: 4,
      });
      const word = out.text.trim().toUpperCase();
      if (word.startsWith("YES")) judged[c.label] = true;
      else if (word.startsWith("NO")) judged[c.label] = false;
      // anything else: leave unjudged (criterion is excluded rather than guessed)
    } catch {
      // judge failures never fail the attempt
    }
  }
  return judged;
}
