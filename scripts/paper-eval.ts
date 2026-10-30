/**
 * Raw measurements for the research paper's results section (charts and tables are built from this JSON).
 * For every item-bank task, runs an expert (the task's sample prompt), an average and a lazy prompt through the
 * simulated cloud model, and the expert and average prompts through the simulated small local model, recording
 * the production scores plus tokens, latency and cost. Also dumps each task's context so PII can be flagged.
 *
 *   npx tsx scripts/paper-eval.ts [out.json]
 */
import { writeFileSync } from "node:fs";
import { SEED_TASKS } from "../lib/server/db/seed-data";
import type { Task } from "../lib/server/db/schema";
import { composeUserMessage, simulatedProvider, simulatedSmallProvider, type LlmProvider } from "../lib/server/llm";
import { scoreAttempt, detectTechniques } from "../lib/scoring";
import { CLOUD_USD_PER_MTOK } from "../lib/server/services/lab";

const tasks = SEED_TASKS.map((t) => ({ ...t, active: true, createdAt: new Date() })) as unknown as Task[];

const AVERAGE: Record<string, string> = {
  summarization: "Please summarize the following text and tell me the important parts of it.",
  extraction: "Find the invoice totals in this email thread and tell me what is owed.",
  rewriting: "Rewrite this text so that it sounds better and more professional for the reader.",
  explanation: "Explain what is going on in the following and why it is a problem.",
  classification: "Classify each of the following support tickets into a suitable category.",
  reasoning: "Work out which of these two options is cheaper and tell me the answer.",
  code: "Review this code and tell me what is wrong with it and how to improve it.",
  qa: "Answer the questions below using the policy document provided here.",
};
const LAZY = "Help with this.";

async function run(provider: LlmProvider, task: Task, prompt: string, usdPerMTok: number) {
  const c = await provider.complete({ user: composeUserMessage(prompt, task.context), maxTokens: task.tokenBudget, task, learnerPrompt: prompt });
  const s = scoreAttempt({ task, prompt, response: c.text, promptTokens: c.inputTokens, outputTokens: c.outputTokens });
  return {
    success: s.taskSuccess, efficiency: s.efficiency, clarity: s.clarity,
    promptTokens: c.inputTokens, outputTokens: c.outputTokens, tokens: s.totalTokens,
    latencyMs: c.latencyMs, costUsd: (s.totalTokens * usdPerMTok) / 1e6,
    techniques: detectTechniques(prompt).map((t) => t.id), feedbackItems: s.feedback.length,
  };
}

async function main() {
  const rows = [];
  for (const t of tasks) {
    const avg = AVERAGE[t.domain];
    rows.push({
      task: t.id, title: t.title, domain: t.domain, difficulty: t.difficulty, medianTokens: t.medianTokens,
      context: t.context,
      cloud: {
        expert: await run(simulatedProvider, t, t.samplePrompt, CLOUD_USD_PER_MTOK),
        average: await run(simulatedProvider, t, avg, CLOUD_USD_PER_MTOK),
        lazy: await run(simulatedProvider, t, LAZY, CLOUD_USD_PER_MTOK),
      },
      local: {
        expert: await run(simulatedSmallProvider, t, t.samplePrompt, 0),
        average: await run(simulatedSmallProvider, t, avg, 0),
      },
    });
  }
  const file = process.argv[2] ?? "paper-results.json";
  writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), cloudUsdPerMTok: CLOUD_USD_PER_MTOK, rows }, null, 2));
  console.log("wrote", file, rows.length, "tasks");
}

main();
