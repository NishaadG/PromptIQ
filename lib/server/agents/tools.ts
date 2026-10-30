/** Tools shared by several agents. Each reads only what the starting user is allowed to see. */
import { and, desc, eq } from "drizzle-orm";
import { attempts, tasks, type RubricCriterion, type Task } from "../db/schema";
import { AgentError, type Tool } from "./core";

/** Techniques the tutor and planner coach. Few-shot and answer-only are left out on purpose (see feedback.ts). */
export const COACHED = {
  role: "Role / persona",
  audience: "Named audience",
  structured: "Structured output",
  length_limit: "Length constraint",
  numbered_asks: "Numbered asks",
  chain_of_thought: "Chain-of-thought",
} as const;
export type Coached = keyof typeof COACHED;

/** Which technique most directly fixes a failed rubric criterion of this kind. */
export function techniqueFor(kind: RubricCriterion["kind"], domain: Task["domain"]): Coached {
  if (kind === "json_fields" || kind === "regex") return "structured";
  if (kind === "max_words") return "length_limit";
  if (kind === "llm_judge" || kind === "excludes") return "audience";
  if (["reasoning", "code"].includes(domain)) return "chain_of_thought";
  return "numbered_asks";
}

export type AttemptView = {
  id: string; prompt: string; taskSuccess: number; efficiency: number; clarity: number; totalTokens: number; latencyMs: number; provider: string;
  techniques: string[];
  criteria: { label: string; passed: boolean; weight: number; kind: RubricCriterion["kind"] }[];
  task: Pick<Task, "id" | "title" | "brief" | "domain" | "medianTokens" | "tokenBudget" | "samplePrompt" | "context" | "rubric">;
};

export const getAttempt: Tool<{ attemptId: string }, AttemptView> = {
  description: "Load one of the learner's own attempts: prompt, scores, techniques used and each rubric criterion with its kind.",
  async run({ db, user }, { attemptId }) {
    const [row] = await db
      .select({ a: attempts, t: tasks })
      .from(attempts)
      .innerJoin(tasks, eq(tasks.id, attempts.taskId))
      .where(and(eq(attempts.id, attemptId), eq(attempts.userId, user.id)))
      .limit(1);
    if (!row) throw new AgentError(404, "Attempt not found");
    const kindOf = new Map(row.t.rubric.map((c) => [c.label, c.kind]));
    return {
      id: row.a.id, prompt: row.a.prompt, taskSuccess: row.a.taskSuccess, efficiency: row.a.efficiency, clarity: row.a.clarity,
      totalTokens: row.a.totalTokens, latencyMs: row.a.latencyMs, provider: row.a.provider,
      techniques: row.a.techniques.map((t) => t.id),
      criteria: row.a.criteria.map((c) => ({ ...c, kind: kindOf.get(c.label) ?? "includes_any" })),
      task: {
        id: row.t.id, title: row.t.title, brief: row.t.brief, domain: row.t.domain, medianTokens: row.t.medianTokens,
        tokenBudget: row.t.tokenBudget, samplePrompt: row.t.samplePrompt, context: row.t.context, rubric: row.t.rubric,
      },
    };
  },
};

export type LearnerProfile = {
  attempts: number;
  usage: Record<Coached, number>; // share of attempts using each technique, 0–1
  weakTechniques: Coached[]; // used in under a quarter of attempts, least used first
  domains: { domain: string; mean: number; n: number }[];
  weakDomains: string[];
};

/** Learner memory: what the learner habitually does and where they struggle, from their recent attempts. */
export const learnerProfile: Tool<Record<string, never>, LearnerProfile> = {
  description: "Summarise the learner's last 30 attempts: how often they use each technique and their mean score per task domain.",
  async run({ db, user }) {
    const rows = await db
      .select({ techniques: attempts.techniques, success: attempts.taskSuccess, domain: tasks.domain })
      .from(attempts)
      .innerJoin(tasks, eq(tasks.id, attempts.taskId))
      .where(eq(attempts.userId, user.id))
      .orderBy(desc(attempts.createdAt))
      .limit(30);
    const keys = Object.keys(COACHED) as Coached[];
    const usage = Object.fromEntries(keys.map((k) => [k, rows.length ? rows.filter((r) => r.techniques.some((t) => t.id === k)).length / rows.length : 0])) as Record<Coached, number>;
    const by = new Map<string, number[]>();
    for (const r of rows) by.set(r.domain, [...(by.get(r.domain) ?? []), r.success]);
    const domains = [...by.entries()].map(([domain, xs]) => ({ domain, n: xs.length, mean: Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) }));
    return {
      attempts: rows.length, usage,
      weakTechniques: keys.filter((k) => usage[k] < 0.25).sort((a, b) => usage[a] - usage[b]),
      domains, weakDomains: domains.filter((d) => d.mean < 70).map((d) => d.domain),
    };
  },
};
