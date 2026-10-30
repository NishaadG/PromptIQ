/**
 * Agent orchestrator (paper §III-I). Every agent runs the same loop — decide, call a tool, read the
 * result, decide again (ReAct) — under four safeguards:
 *   1. it may call only the tools on its allow-list;
 *   2. each run has a step budget and a model-token budget;
 *   3. every step is logged to agent_runs;
 *   4. agents that change platform state only *propose*: an admin approves before anything is applied.
 *
 * Each agent ships a scripted policy, so the layer works offline and in tests. With a real model
 * configured and AGENT_POLICY=llm, a model chooses the next step instead (tool allow-list still enforced).
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../db/client";
import { agentRuns, type AgentName, type AgentRun, type AgentStep, type User } from "../db/schema";
import { getProvider, type LlmProvider } from "../llm";

export class AgentError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type AgentContext = {
  db: DB;
  user: User; // who started the run
  provider: LlmProvider;
  /** Record model tokens spent by a tool; throws once the run's token budget is exhausted. */
  spend(tokens: number): void;
};

export type Tool<I = unknown, O = unknown> = {
  description: string;
  run(ctx: AgentContext, input: I): Promise<O>;
};

export type Observation = { tool: string; input: unknown; output: unknown };
export type AgentState<In> = { input: In; history: Observation[]; notes: string[] };
export type Decision = { thought?: string; tool: string; input: unknown } | { thought?: string; final: unknown };

export type AgentDef<In, Out> = {
  name: AgentName;
  goal: string;
  tools: Record<string, Tool<never, unknown>>; // the allow-list: nothing else is callable
  maxSteps: number;
  maxTokens: number;
  /** True for agents whose output changes scores, tasks or models: the run waits for an admin. */
  requiresApproval?: boolean;
  subjectOf(input: In): string | null;
  policy(state: AgentState<In>): Decision;
  /** Validate and shape the final answer; throw to fail the run (e.g. a tutor that leaked a full prompt). */
  finalize(state: AgentState<In>, final: unknown): Out;
  /** Apply an approved proposal. Runs only after an admin approves. */
  apply?(ctx: AgentContext, output: Out, run: AgentRun): Promise<void>;
};

/** Latest observation from a given tool, typed by the caller. */
export function seen<T>(state: AgentState<unknown>, tool: string): T | undefined {
  for (let i = state.history.length - 1; i >= 0; i--) if (state.history[i].tool === tool) return state.history[i].output as T;
  return undefined;
}
export const calls = (state: AgentState<unknown>, tool: string) => state.history.filter((h) => h.tool === tool).length;

const usePolicy = (provider: LlmProvider) => (process.env.AGENT_POLICY === "llm" && !provider.name.startsWith("simulated") ? "llm" : "scripted");

export async function runAgent<In, Out>(def: AgentDef<In, Out>, args: { db: DB; user: User; input: In; provider?: LlmProvider }) {
  const { db, user, input } = args;
  const provider = args.provider ?? getProvider();
  const policyKind = usePolicy(provider);
  const id = randomUUID();
  await db.insert(agentRuns).values({ id, agent: def.name, userId: user.id, subjectId: def.subjectOf(input), status: "running", policy: policyKind, input });

  let tokens = 0;
  const ctx: AgentContext = {
    db, user, provider,
    spend(n) {
      tokens += n;
      if (tokens > def.maxTokens) throw new AgentError(429, `Token budget of ${def.maxTokens} exceeded`);
    },
  };
  const state: AgentState<In> = { input, history: [], notes: [] };
  const steps: AgentStep[] = [];
  const finish = (patch: Partial<AgentRun>) =>
    db.update(agentRuns).set({ steps, tokensUsed: tokens, finishedAt: new Date(), ...patch }).where(eq(agentRuns.id, id)).returning();

  try {
    for (let i = 0; ; i++) {
      if (i >= def.maxSteps) throw new AgentError(429, `Step budget of ${def.maxSteps} exceeded`);
      const decision = policyKind === "llm" ? await llmDecide(def, state, ctx).catch(() => def.policy(state)) : def.policy(state);
      if ("final" in decision) {
        const output = def.finalize(state, decision.final);
        const status = def.requiresApproval ? "awaiting_approval" : "completed";
        const [row] = await finish({ status, output: output as unknown });
        return { run: row, output };
      }
      const tool = def.tools[decision.tool];
      if (!tool) throw new AgentError(403, `Tool "${decision.tool}" is not on the ${def.name} allow-list`);
      const t0 = Date.now();
      try {
        const output = await tool.run(ctx, decision.input as never);
        steps.push({ tool: decision.tool, input: decision.input, output: summarise(output), thought: decision.thought, ms: Date.now() - t0 });
        state.history.push({ tool: decision.tool, input: decision.input, output });
      } catch (e) {
        steps.push({ tool: decision.tool, input: decision.input, error: (e as Error).message, thought: decision.thought, ms: Date.now() - t0 });
        throw e;
      }
    }
  } catch (e) {
    await finish({ status: "failed", error: (e as Error).message });
    if (e instanceof AgentError) throw e;
    throw new AgentError(500, `The ${def.name.replace("_", " ")} could not finish: ${(e as Error).message}`);
  }
}

/** Keep the step log small: long strings are trimmed, big arrays are counted. */
function summarise(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return v.length > 240 ? `${v.slice(0, 240)}…` : v;
  if (Array.isArray(v)) return v.length > 8 ? `[${v.length} items]` : v.map((x) => summarise(x, depth + 1));
  if (v && typeof v === "object") {
    if (depth > 2) return "{…}";
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, summarise(x, depth + 1)]));
  }
  return v;
}

/** Approve or reject a proposal. Approval applies it; either way the decision is recorded. */
export async function decideRun<In, Out>(db: DB, admin: User, def: AgentDef<In, Out>, runId: string, approve: boolean) {
  const [run] = await db.select().from(agentRuns).where(and(eq(agentRuns.id, runId), eq(agentRuns.agent, def.name))).limit(1);
  if (!run) throw new AgentError(404, "Agent run not found");
  if (run.status !== "awaiting_approval") throw new AgentError(409, `Run is ${run.status.replace("_", " ")}, not awaiting approval`);
  if (approve && def.apply) {
    const ctx: AgentContext = { db, user: admin, provider: getProvider(), spend() {} };
    await def.apply(ctx, run.output as Out, run);
  }
  const [row] = await db
    .update(agentRuns)
    .set({ status: approve ? "approved" : "rejected", decidedBy: admin.id, decidedAt: new Date() })
    .where(eq(agentRuns.id, runId))
    .returning();
  return row;
}

export async function listRuns(db: DB, opts: { status?: AgentRun["status"]; limit?: number } = {}) {
  const q = db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(opts.limit ?? 30);
  return opts.status ? q.where(eq(agentRuns.status, opts.status)) : q;
}

/* ----------------------------------------------------------------------------- LLM policy */

const LLM_POLICY_SYSTEM =
  "You are the controller of a software agent. Choose the next step. Reply with JSON only: " +
  '{"thought": "...", "tool": "<tool name>", "input": {...}} to call a tool, or {"thought": "...", "final": ...} when done. ' +
  "Use only the tools listed.";

async function llmDecide<In, Out>(def: AgentDef<In, Out>, state: AgentState<In>, ctx: AgentContext): Promise<Decision> {
  // The scripted policy's suggestion is offered as a hint and as the shape of a valid answer.
  const hint = def.policy(state);
  const tools = Object.entries(def.tools).map(([n, t]) => `- ${n}: ${t.description}`).join("\n");
  const user =
    `GOAL: ${def.goal}\nTOOLS:\n${tools}\nINPUT: ${JSON.stringify(state.input)}\n` +
    `HISTORY: ${JSON.stringify(state.history.map((h) => ({ tool: h.tool, input: h.input, output: summarise(h.output) })))}\n` +
    `NOTES: ${JSON.stringify(state.notes)}\nSUGGESTED NEXT STEP: ${JSON.stringify(hint)}`;
  const c = await ctx.provider.complete({ system: LLM_POLICY_SYSTEM, user, maxTokens: 400 });
  ctx.spend(c.inputTokens + c.outputTokens);
  const raw = c.text.slice(c.text.indexOf("{"), c.text.lastIndexOf("}") + 1);
  const d = JSON.parse(raw) as Decision;
  // A model may pick the step; it may not invent the final answer's shape. Finals come from the scripted policy.
  if ("final" in d) return "final" in hint ? hint : d;
  if (typeof d.tool !== "string") throw new Error("no tool");
  return d;
}
