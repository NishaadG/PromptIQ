/**
 * Task Author. Takes a draft task and checks that it measures prompting skill before it reaches
 * learners: the reference answer must pass its own rubric, and the expert, average and lazy reference
 * prompts must score in that order with a clear gap. A draft that passes is proposed for publishing;
 * an admin approves before it enters the item bank.
 */
import { eq } from "drizzle-orm";
import { tasks, type Task } from "../db/schema";
import { composeUserMessage } from "../llm";
import { judgeCriteria } from "../judge";
import { scoreAttempt } from "../../scoring";
import { AVERAGE_PROMPTS, LAZY_PROMPT } from "../../scoring/reference-prompts";
import { taskInputSchema, upsertTask, type TaskInput } from "../services/admin";
import { AgentError, calls, seen, type AgentDef, type Tool } from "./core";

export const AUTHOR_RULES = { expertMin: 85, minSpread: 20 } as const;

type Validated = { ok: true; draft: TaskInput; existing: boolean } | { ok: false; issues: string[] };
type Level = { level: "expert" | "average" | "lazy"; prompt: string; taskSuccess: number; missing: string[] };

/** A draft as a task row, so the scorer and models can run it before it exists. */
const asTask = (d: TaskInput): Task => ({ ...d, number: 0, difficultyRating: 1000, createdAt: new Date() });

const validateDraft: Tool<{ draft: unknown }, Validated> = {
  description: "Check the draft against the task schema and whether it would replace an existing task.",
  async run({ db }, { draft }) {
    const r = taskInputSchema.safeParse(draft);
    if (!r.success) return { ok: false, issues: r.error.issues.map((i) => `${i.path.join(".") || "draft"}: ${i.message}`) };
    const [existing] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, r.data.id)).limit(1);
    return { ok: true, draft: r.data, existing: !!existing };
  },
};

const checkReference: Tool<{ draft: TaskInput }, { taskSuccess: number; missing: string[] }> = {
  description: "Score the draft's reference answer against its own rubric. It must reach 100.",
  async run(_ctx, { draft }) {
    const s = scoreAttempt({ task: asTask(draft), prompt: draft.samplePrompt, response: draft.simulatedResponse, promptTokens: 0, outputTokens: 0 });
    return { taskSuccess: s.taskSuccess, missing: s.criteria.filter((c) => !c.passed).map((c) => c.label) };
  },
};

const runReferencePrompts: Tool<{ draft: TaskInput }, Level[]> = {
  description: "Run the expert (sample), average and lazy reference prompts on the assessment model and score each.",
  async run({ provider, spend }, { draft }) {
    const task = asTask(draft);
    const levels = [
      { level: "expert" as const, prompt: draft.samplePrompt },
      { level: "average" as const, prompt: AVERAGE_PROMPTS[draft.domain] },
      { level: "lazy" as const, prompt: LAZY_PROMPT },
    ];
    const out: Level[] = [];
    for (const l of levels) {
      const c = await provider.complete({ user: composeUserMessage(l.prompt, task.context), maxTokens: Math.max(256, task.tokenBudget), task, learnerPrompt: l.prompt });
      spend(c.inputTokens + c.outputTokens);
      const judged = await judgeCriteria(provider, task.rubric, { brief: task.brief, response: c.text });
      const s = scoreAttempt({ task, prompt: l.prompt, response: c.text, promptTokens: c.inputTokens, outputTokens: c.outputTokens, judged });
      out.push({ ...l, taskSuccess: s.taskSuccess, missing: s.criteria.filter((x) => !x.passed).map((x) => x.label) });
    }
    return out;
  },
};

export type AuthorProposal = {
  taskId: string; title: string; existing: boolean; passed: boolean; issues: string[];
  reference: number | null; levels: Level[];
  draft: TaskInput | null;
};

export const taskAuthor: AgentDef<{ draft: unknown }, AuthorProposal> = {
  name: "task_author",
  goal: "Check that a draft task separates expert, average and lazy prompts, then propose it for the item bank.",
  tools: { validate_draft: validateDraft, check_reference: checkReference, run_reference_prompts: runReferencePrompts },
  maxSteps: 5,
  maxTokens: 15_000,
  requiresApproval: true,
  subjectOf: (i) => {
    const id = (i.draft as { id?: unknown } | null)?.id;
    return typeof id === "string" ? id.slice(0, 64) : null;
  },
  policy(state) {
    const { draft } = state.input;
    if (!calls(state, "validate_draft")) return { thought: "Check the draft is well formed.", tool: "validate_draft", input: { draft } };
    const v = seen<Validated>(state, "validate_draft")!;
    if (!v.ok) return { final: true };
    if (!calls(state, "check_reference")) return { thought: "The reference answer must pass its own rubric.", tool: "check_reference", input: { draft: v.draft } };
    if (seen<{ taskSuccess: number }>(state, "check_reference")!.taskSuccess < 100) return { final: true };
    if (!calls(state, "run_reference_prompts")) return { thought: "Does the rubric separate prompt quality?", tool: "run_reference_prompts", input: { draft: v.draft } };
    return { final: true };
  },
  finalize(state) {
    const v = seen<Validated>(state, "validate_draft")!;
    const raw = state.input.draft as { id?: unknown; title?: unknown } | null;
    if (!v.ok) {
      return { taskId: String(raw?.id ?? "?"), title: String(raw?.title ?? "Untitled"), existing: false, passed: false, issues: v.issues, reference: null, levels: [], draft: null };
    }
    const ref = seen<{ taskSuccess: number; missing: string[] }>(state, "check_reference")!;
    const levels = seen<Level[]>(state, "run_reference_prompts") ?? [];
    const issues: string[] = [];
    if (ref.taskSuccess < 100) issues.push(`The reference answer scores ${ref.taskSuccess}, not 100; it fails: ${ref.missing.join("; ")}.`);
    const [expert, average, lazy] = levels;
    if (expert && expert.taskSuccess < AUTHOR_RULES.expertMin) issues.push(`The sample prompt scores ${expert.taskSuccess}; it should reach ${AUTHOR_RULES.expertMin}. Missing: ${expert.missing.join("; ") || "nothing"}.`);
    if (expert && average && lazy) {
      if (!(expert.taskSuccess > average.taskSuccess && average.taskSuccess >= lazy.taskSuccess)) {
        issues.push(`Scores are out of order (expert ${expert.taskSuccess}, average ${average.taskSuccess}, lazy ${lazy.taskSuccess}); the rubric does not reward a better prompt.`);
      }
      if (expert.taskSuccess - lazy.taskSuccess < AUTHOR_RULES.minSpread) {
        issues.push(`Expert and lazy prompts are only ${expert.taskSuccess - lazy.taskSuccess} points apart; add criteria a vague prompt would miss.`);
      }
    }
    return { taskId: v.draft.id, title: v.draft.title, existing: v.existing, passed: issues.length === 0, issues, reference: ref.taskSuccess, levels, draft: v.draft };
  },
  async apply({ db }, proposal) {
    if (!proposal.passed || !proposal.draft) throw new AgentError(409, "This draft failed its checks; revise it and run the Task Author again");
    await upsertTask(db, proposal.draft);
  },
};
