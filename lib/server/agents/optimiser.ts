/**
 * Prompt Optimiser. Rewrites a submitted prompt in up to three passes, re-runs it on the same model
 * and keeps the best version. After each pass that falls short it writes a note on what is still
 * missing and the next pass targets that (Reflexion-style). Optimiser runs are practice: they are
 * never stored as attempts and earn nothing.
 */
import { judgeCriteria } from "../judge";
import { composeUserMessage } from "../llm";
import { gatePrompt, isExternalProvider } from "../privacy";
import { scoreAttempt } from "../../scoring";
import { pesComponents, pesGated } from "../../scoring/pes";
import { detectTechniques } from "../../scoring/techniques";
import { AgentError, calls, seen, type AgentDef, type AgentState, type Tool } from "./core";
import { getAttempt, type AttemptView } from "./tools";
import { CLOUD_USD_PER_MTOK } from "../services/lab";
import { eq } from "drizzle-orm";
import { tasks } from "../db/schema";

type Version = { prompt: string; taskSuccess: number; totalTokens: number; pes: number; missing: string[] };
export type OptimiserResult = {
  original: Version;
  optimised: Version;
  improved: boolean;
  changes: { what: string; why: string }[];
  notes: string[];
};

type Rewrite = { prompt: string; changes: { what: string; why: string }[] };
type RewriteInput = { pass: 1 | 2 | 3; base: string; missing: string[]; labels: string[]; needsJson: boolean; maxWords: number | null; domain: string };

const REASONING = new Set(["reasoning", "code", "explanation"]);

/** Cumulative rewrite passes: 1 enumerate the asks, 2 add format and length, 3 add reasoning and a reader. */
export function rewrite({ pass, base, missing, labels, needsJson, maxWords, domain }: RewriteInput): Rewrite {
  const ts = new Set(detectTechniques(base).map((t) => t.id));
  const changes: Rewrite["changes"] = [];
  let p = base.trim();

  if (!ts.has("numbered_asks")) {
    // Missing items first, so the model treats them as the priority.
    const asks = [...missing, ...labels.filter((l) => !missing.includes(l))];
    p += `\n\nIn your answer:\n${asks.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
    changes.push({ what: "Listed every requirement as a numbered ask", why: "Models drop requirements that are implied rather than listed." });
  }
  if (pass >= 2) {
    if (needsJson && !ts.has("structured")) {
      p += "\nReturn only JSON — no other text.";
      changes.push({ what: "Asked for JSON only", why: "This task is checked field by field, so the output shape must be exact." });
    }
    if (maxWords && !ts.has("length_limit")) {
      p += `\nKeep it under ${maxWords} words.`;
      changes.push({ what: `Added a ${maxWords}-word limit`, why: "Without a limit the model pads its answer and breaks the length criterion." });
    }
  }
  if (pass >= 3) {
    if (REASONING.has(domain) && !ts.has("chain_of_thought")) {
      p += "\nWork through it briefly step by step, then give the final answer on its own line.";
      changes.push({ what: "Asked for brief step-by-step working", why: "Multi-step tasks fail when the model jumps straight to an answer." });
    }
    if (!ts.has("audience") && !REASONING.has(domain)) {
      p = `Write for a reader who needs exactly what the brief describes — no preamble, no recap.\n${p}`;
      changes.push({ what: "Named the reader", why: "A named reader removes generic filler and steers what to leave out." });
    }
  }
  return { prompt: p, changes };
}

const rewritePrompt: Tool<RewriteInput, Rewrite> = {
  description: "Rewrite the prompt. pass 1 enumerates the asks; pass 2 adds output format and length; pass 3 adds reasoning or a named reader.",
  async run(_ctx, input) {
    return rewrite(input);
  },
};

const runPrompt: Tool<{ taskId: string; prompt: string }, Version> = {
  description: "Run a prompt on the task with the assessment model and score it. Not saved as an attempt.",
  async run(ctx, { taskId, prompt }) {
    const [task] = await ctx.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) throw new AgentError(404, "Task not found");
    const gate = gatePrompt(prompt, { external: isExternalProvider(ctx.provider.name) });
    if (!gate.ok) throw new AgentError(400, gate.reason);
    const c = await ctx.provider.complete({ user: composeUserMessage(gate.text, task.context), maxTokens: Math.max(256, task.tokenBudget), task, learnerPrompt: gate.text });
    ctx.spend(c.inputTokens + c.outputTokens);
    const judged = await judgeCriteria(ctx.provider, task.rubric, { brief: task.brief, response: c.text });
    const s = scoreAttempt({ task, prompt, response: c.text, promptTokens: c.inputTokens, outputTokens: c.outputTokens, judged });
    return versionOf(prompt, s, c.latencyMs, task.medianTokens, ctx.provider.name);
  },
};

function versionOf(prompt: string, s: { taskSuccess: number; totalTokens: number; clarity: number; criteria: { label: string; passed: boolean }[] }, latencyMs: number, medianTokens: number, provider: string): Version {
  const price = provider === "simulated-local" || provider === "local" ? 0 : CLOUD_USD_PER_MTOK;
  const pes = pesGated(pesComponents({
    clarity: s.clarity, taskSuccess: s.taskSuccess, totalTokens: s.totalTokens, latencyMs,
    costUsd: (s.totalTokens * price) / 1e6, medianTokens, referenceCostUsd: (medianTokens * price) / 1e6,
  }));
  return { prompt, taskSuccess: s.taskSuccess, totalTokens: s.totalTokens, pes, missing: s.criteria.filter((c) => !c.passed).map((c) => c.label) };
}

export type OptimiserInput = { attemptId: string };
const TARGET = 95;

function runs(state: AgentState<OptimiserInput>) {
  return state.history.filter((h) => h.tool === "run_prompt").map((h) => h.output as Version);
}

export const promptOptimiser: AgentDef<OptimiserInput, OptimiserResult> = {
  name: "prompt_optimiser",
  goal: "Find a better version of the learner's prompt for this task and explain what changed and why.",
  tools: { get_attempt: getAttempt, rewrite_prompt: rewritePrompt, run_prompt: runPrompt },
  maxSteps: 10,
  maxTokens: 12_000,
  subjectOf: (i) => i.attemptId,
  policy(state) {
    const a = seen<AttemptView>(state, "get_attempt");
    if (!a) return { thought: "Read the attempt.", tool: "get_attempt", input: { attemptId: state.input.attemptId } };
    const original = { prompt: a.prompt, missing: a.criteria.filter((c) => !c.passed).map((c) => c.label) };
    const done = runs(state);
    const last = done[done.length - 1];
    const rewrites = calls(state, "rewrite_prompt");

    // Reflect on the last pass before choosing the next one.
    if (last && state.notes.length < done.length) {
      state.notes.push(last.missing.length ? `Pass ${done.length} scored ${last.taskSuccess}; still missing: ${last.missing.join("; ")}.` : `Pass ${done.length} met every criterion (${last.taskSuccess}).`);
    }
    if ((last && last.taskSuccess >= TARGET) || rewrites >= 3) return { final: true };
    if (rewrites === done.length) {
      const pass = (rewrites + 1) as 1 | 2 | 3;
      const maxWords = a.task.rubric.reduce<number | null>((m, c) => (c.kind === "max_words" ? Math.min(m ?? c.max, c.max) : m), null);
      return {
        thought: `Rewrite pass ${pass}.`, tool: "rewrite_prompt",
        input: {
          pass, base: a.prompt, missing: last?.missing ?? original.missing, labels: a.criteria.map((c) => c.label),
          needsJson: a.criteria.some((c) => c.kind === "json_fields"), maxWords, domain: a.task.domain,
        },
      };
    }
    const rw = seen<Rewrite>(state, "rewrite_prompt")!;
    return { thought: "Test the rewrite on the same model.", tool: "run_prompt", input: { taskId: a.task.id, prompt: rw.prompt } };
  },
  finalize(state) {
    const a = seen<AttemptView>(state, "get_attempt")!;
    const original: Version = {
      prompt: a.prompt, taskSuccess: a.taskSuccess, totalTokens: a.totalTokens, missing: a.criteria.filter((c) => !c.passed).map((c) => c.label),
      pes: versionOf(a.prompt, a, a.latencyMs, a.task.medianTokens, a.provider).pes,
    };
    const tried = runs(state);
    const rewrites = state.history.filter((h) => h.tool === "rewrite_prompt").map((h) => h.output as Rewrite);
    // Best by task success, then by fewer tokens.
    let bestIdx = -1;
    tried.forEach((v, i) => {
      const b = tried[bestIdx];
      if (!b || v.taskSuccess > b.taskSuccess || (v.taskSuccess === b.taskSuccess && v.totalTokens < b.totalTokens)) bestIdx = i;
    });
    const best = tried[bestIdx];
    const improved = !!best && best.taskSuccess > original.taskSuccess;
    return {
      original,
      optimised: improved ? best : original,
      improved,
      changes: improved ? rewrites[bestIdx].changes : [],
      notes: state.notes,
    };
  },
};
