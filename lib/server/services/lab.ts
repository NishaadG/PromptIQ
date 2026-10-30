/**
 * Local Lab: run one prompt on a "cloud" model and a small "local" model side by side, score both
 * against the task rubric, and compare quality, cost and latency (PromptIQ doc, Module 2).
 */
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { DB } from "../db/client";
import { labRuns, tasks, type LabSide, type Task, type User } from "../db/schema";
import { composeUserMessage, getLocalProvider, getProvider, type LlmProvider } from "../llm";
import { scoreAttempt } from "../../scoring";
import { AttemptError, MAX_PROMPT_CHARS } from "./attempts";
import { gatePrompt, hasPersonalData, isExternalProvider, scanSensitive } from "../privacy";
import { route } from "../router";

/** Reference price for the cloud side, USD per million tokens (blended). Local inference is $0 marginal. */
export const CLOUD_USD_PER_MTOK = Number(process.env.CLOUD_USD_PER_MTOK ?? 5);

/** `sent` is the prompt as this model receives it (masked for external models); scoring uses what the learner wrote. */
async function runSide(provider: LlmProvider, task: Task, prompt: string, sent: string, label: string, pricePerMTok: number): Promise<LabSide> {
  const c = await provider.complete({ user: composeUserMessage(sent, task.context), maxTokens: Math.max(256, task.tokenBudget), task, learnerPrompt: sent });
  const s = scoreAttempt({ task, prompt, response: c.text, promptTokens: c.inputTokens, outputTokens: c.outputTokens });
  return {
    provider: c.provider, model: c.model, label, response: c.text, taskSuccess: s.taskSuccess,
    totalTokens: s.totalTokens, latencyMs: c.latencyMs, costUsd: (s.totalTokens * pricePerMTok) / 1e6,
  };
}

export async function runLab(db: DB, user: User, taskId: string, prompt: string, providers?: { cloud: LlmProvider; local: LlmProvider }) {
  const p = prompt.trim();
  if (!p || p.length > MAX_PROMPT_CHARS) throw new AttemptError(400, "Prompt must be 1–8000 characters");
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new AttemptError(404, "Task not found");
  const cloudP = providers?.cloud ?? getProvider();
  const localP = providers?.local ?? getLocalProvider();
  const cloudGate = gatePrompt(p, { external: isExternalProvider(cloudP.name) });
  const localGate = gatePrompt(p, { external: isExternalProvider(localP.name) });
  if (!cloudGate.ok) throw new AttemptError(400, cloudGate.reason);
  if (!localGate.ok) throw new AttemptError(400, localGate.reason);
  const [cloud, local] = await Promise.all([
    runSide(cloudP, task, p, cloudGate.text, cloudP.name.startsWith("simulated") ? "Simulated cloud model" : "Cloud model", CLOUD_USD_PER_MTOK),
    runSide(localP, task, p, localGate.text, localP.name.startsWith("simulated") ? "Simulated 3B local model" : "Your local model", 0),
  ]);
  const [row] = await db.insert(labRuns).values({ id: randomUUID(), userId: user.id, taskId, prompt: p, cloud, local }).returning();

  // Router (paper Eq. 3). The privacy term looks at everything the model would see: prompt and source text.
  const personalData = hasPersonalData(cloudGate.findings) || hasPersonalData(scanSensitive(task.context));
  const routing = route(
    [
      { id: "local", taskSuccess: local.taskSuccess, costUsd: local.costUsd, latencyMs: local.latencyMs, external: isExternalProvider(localP.name) },
      // The simulated cloud model stands in for an external API, so it carries the privacy penalty too.
      { id: "cloud", taskSuccess: cloud.taskSuccess, costUsd: cloud.costUsd, latencyMs: cloud.latencyMs, external: true },
    ],
    { personalData, budgetCostUsd: (task.tokenBudget * CLOUD_USD_PER_MTOK) / 1e6 },
  );
  const privacy = { personalData, maskedForCloud: cloudGate.redacted, findings: cloudGate.findings };
  return { run: row, verdict: verdict(cloud, local), routing, privacy };
}

export function verdict(cloud: LabSide, local: LabSide) {
  const gap = cloud.taskSuccess - local.taskSuccess;
  if (gap <= 5) return { kind: "matched" as const, gap, text: `The local model matched the cloud model here (${gap <= 0 ? "no" : `${gap}-point`} gap) at zero marginal cost.` };
  if (gap <= 20) return { kind: "close" as const, gap, text: `The local model trailed by ${gap} points. Enumerating your asks or asking for brief step-by-step reasoning often closes this gap on small models.` };
  return { kind: "gap" as const, gap, text: `A ${gap}-point gap: this task needs a bigger model — or a much more explicit prompt — than a small local model offers.` };
}

/** Per-category averages across the learner's Lab runs. */
export async function labHistory(db: DB, userId: string) {
  const rows = await db
    .select({ id: labRuns.id, category: tasks.category, cloud: labRuns.cloud, local: labRuns.local, createdAt: labRuns.createdAt })
    .from(labRuns)
    .innerJoin(tasks, eq(tasks.id, labRuns.taskId))
    .where(eq(labRuns.userId, userId))
    .orderBy(desc(labRuns.createdAt))
    .limit(200);
  const by = new Map<string, { cloud: number[]; local: number[] }>();
  for (const r of rows) {
    const b = by.get(r.category) ?? { cloud: [], local: [] };
    b.cloud.push(r.cloud.taskSuccess);
    b.local.push(r.local.taskSuccess);
    by.set(r.category, b);
  }
  const avg = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
  return [...by.entries()].map(([category, b]) => ({ category, runs: b.cloud.length, cloud: avg(b.cloud), local: avg(b.local) }));
}
