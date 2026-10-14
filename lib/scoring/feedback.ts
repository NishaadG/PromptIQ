/**
 * Feedback generation. The research-backed rules cite findings from our study
 * "How Many Parameters Is a Prompt Worth?" (PCCOE, 2026), so learners get evidence, not folklore.
 */
import type { DetectedTechnique, FeedbackItem, Task } from "../server/db/schema";
import { has } from "./techniques";
import type { CriterionResult } from "./rubric";

const STUDY = "PromptIQ study, 2026";
const REASONING_DOMAINS = new Set(["reasoning", "code", "explanation"]);

export function buildFeedback(args: {
  task: Pick<Task, "domain" | "tokenBudget" | "medianTokens" | "context">;
  prompt: string;
  promptTokens: number;
  totalTokens: number;
  techniques: DetectedTechnique[];
  criteria: CriterionResult[];
  taskSuccess: number;
}): FeedbackItem[] {
  const { task, prompt, promptTokens, totalTokens, techniques: ts, criteria, taskSuccess } = args;
  const fb: FeedbackItem[] = [];

  // --- cost ---------------------------------------------------------------------------------
  if (totalTokens > task.tokenBudget) {
    fb.push({ kind: "cost", text: `You used ${totalTokens} tokens against a budget of ${task.tokenBudget}. Cut what the model doesn't need to see.` });
  }
  const contextHead = task.context.slice(0, 120);
  if (contextHead.length > 40 && prompt.includes(contextHead) && task.context.length > 600) {
    fb.push({ kind: "cost", text: "You pasted the full source text. Quote only the part the task is about — it is usually the biggest single token saving." });
  }
  if (has(ts, "few_shot")) {
    fb.push({
      kind: "cost",
      text: "Your examples are re-sent on every call. In our study, few-shot prompts cost 2.1–2.8× the compute of a plain prompt and never paid for themselves versus using a stronger model. Keep them only if the output format is truly unusual.",
      source: STUDY,
    });
  }

  // --- warnings ------------------------------------------------------------------------------
  if ((has(ts, "answer_only") || (has(ts, "structured") && /only/i.test(prompt))) && REASONING_DOMAINS.has(task.domain)) {
    fb.push({
      kind: "warn",
      text: "This task needs working-out, but your prompt asks for the answer only. Capable models obey and skip their reasoning — in our study, accuracy on maths fell from about 0.9 to 0.2–0.3 under an ‘answer only’ instruction. Ask for brief reasoning, then a clearly labelled final answer.",
      source: STUDY,
    });
  }
  if (has(ts, "chain_of_thought") && !REASONING_DOMAINS.has(task.domain)) {
    fb.push({
      kind: "tip",
      text: "‘Think step by step’ mostly adds output tokens here: modern models already reason when they need to, and our study found the explicit trigger rarely improved non-reasoning tasks.",
      source: STUDY,
    });
  }

  // --- wins ------------------------------------------------------------------------------------
  if (has(ts, "audience")) fb.push({ kind: "win", text: "Naming the reader did real work — it steers vocabulary, length and what to leave out, at almost no token cost." });
  if (has(ts, "role")) fb.push({ kind: "win", text: "A one-line role costs nothing and, in our study, was the only technique that consistently paid for itself (worth roughly a 1.2–1.4× larger model on maths and code).", source: STUDY });
  if (has(ts, "length_limit")) fb.push({ kind: "win", text: "Your length limit keeps the output — and your bill — predictable." });

  // --- rubric-driven tips ------------------------------------------------------------------------
  const failed = criteria.filter((c) => !c.passed).sort((a, b) => b.weight - a.weight);
  for (const c of failed.slice(0, 2)) {
    fb.push({ kind: "tip", text: `Missed: ${c.label}${c.detail ? ` (${c.detail})` : ""}. Ask for it explicitly.` });
  }
  if (!failed.length && taskSuccess >= 90 && promptTokens > task.medianTokens * 0.6) {
    fb.push({ kind: "tip", text: "Every criterion met. Next attempt: try reaching the same result with a shorter prompt to lift your efficiency score." });
  }
  if (!fb.some((f) => f.kind === "win") && taskSuccess >= 70) {
    fb.push({ kind: "win", text: "Solid result — the response met most of what the brief asked for." });
  }
  return fb.slice(0, 5);
}
