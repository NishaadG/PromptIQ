import type { Task } from "../server/db/schema";
import { buildFeedback } from "./feedback";
import { clarityScore, efficiencyScore } from "./metrics";
import { evaluateCriterion, rubricScore, type CriterionResult } from "./rubric";
import { detectTechniques } from "./techniques";

export { countTokens, countWords } from "./tokens";
export { detectTechniques } from "./techniques";
export * from "./progression";

/** Score one attempt. `judged` supplies verdicts for llm_judge criteria when a judge model is configured. */
export function scoreAttempt(args: {
  task: Task;
  prompt: string;
  response: string;
  promptTokens: number;
  outputTokens: number;
  judged?: Record<string, boolean>;
}) {
  const { task, prompt, response, promptTokens, outputTokens, judged = {} } = args;
  const criteria: CriterionResult[] = [];
  for (const c of task.rubric) {
    const r = evaluateCriterion(c, response);
    if (r) criteria.push(r);
    else if (c.label in judged) criteria.push({ label: c.label, weight: c.weight, passed: judged[c.label], detail: "judged by model" });
  }
  const totalTokens = promptTokens + outputTokens;
  const taskSuccess = rubricScore(criteria);
  const efficiency = efficiencyScore(taskSuccess, totalTokens, task.medianTokens);
  const clarity = clarityScore(response);
  const techniques = detectTechniques(prompt);
  const feedback = buildFeedback({ task, prompt, promptTokens, totalTokens, techniques, criteria, taskSuccess });
  return { criteria, taskSuccess, efficiency, clarity, techniques, feedback, totalTokens };
}
