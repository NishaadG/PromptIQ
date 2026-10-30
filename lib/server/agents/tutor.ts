/**
 * AI Tutor. Coaches one attempt with a hint ladder in the style of step-based tutoring systems
 * (VanLehn, 2011): each request on the same attempt gives a more specific hint —
 *   1. a guiding question about the most important missed criterion,
 *   2. the technique that fixes it and why,
 *   3. a generic pattern for that technique.
 * It never writes the learner's prompt for them; finalize() rejects any hint that would.
 */
import { and, count, eq } from "drizzle-orm";
import { agentRuns } from "../db/schema";
import { calls, seen, type AgentDef, type Tool } from "./core";
import { COACHED, getAttempt, learnerProfile, techniqueFor, type AttemptView, type Coached, type LearnerProfile } from "./tools";

export type TutorHint = {
  level: 1 | 2 | 3;
  focus: string; // the criterion (or "efficiency") the hint is about
  question: string;
  technique: { id: Coached; name: string } | null;
  explanation: string | null;
  pattern: string | null;
  habit: string | null; // a note from learner memory, when relevant
  lastLevel: boolean;
};

const WHY: Record<Coached, string> = {
  role: "A one-line role sets the expertise and register the model writes in, at almost no token cost.",
  audience: "Naming the reader steers vocabulary, depth and what to leave out — the rubric checks fit for that reader.",
  structured: "When the output is checked by a machine (JSON, labels, fixed fields), the model must be told the exact shape.",
  length_limit: "Without a limit, models pad with preambles and recaps; a word or bullet limit keeps the answer inside the rubric.",
  numbered_asks: "Listing each required item as its own numbered ask stops the model from silently dropping one.",
  chain_of_thought: "Multi-step tasks go wrong when the model jumps to an answer; asking for brief working, then a labelled answer, fixes that.",
};

const PATTERN: Record<Coached, string> = {
  role: "You are a <role with the right expertise>.",
  audience: "Write for <who will read this>, who <what they know or don't know>.",
  structured: "Return only JSON with the keys: <key1>, <key2>, … — no other text.",
  length_limit: "Keep it under <N> words / in <N> bullets.",
  numbered_asks: "In your answer:\n1. <first thing the brief asks for>\n2. <second thing>\n3. …",
  chain_of_thought: "Work through it step by step briefly, then give the final answer on its own line labelled 'Answer:'.",
};

const countHints: Tool<{ attemptId: string }, number> = {
  description: "How many hints the tutor has already given on this attempt.",
  async run({ db, user }, { attemptId }) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(agentRuns)
      .where(and(eq(agentRuns.agent, "tutor"), eq(agentRuns.subjectId, attemptId), eq(agentRuns.userId, user.id), eq(agentRuns.status, "completed")));
    return Number(n);
  },
};

/** Optional: let a real model phrase the hint more naturally. Template text is kept if it leaks or fails. */
const phraseHint: Tool<{ hint: TutorHint; brief: string }, string | null> = {
  description: "Rephrase the hint's question in a warm, Socratic tone without giving the answer.",
  async run({ provider, spend }, { hint, brief }) {
    if (provider.name.startsWith("simulated")) return null;
    const c = await provider.complete({
      system: "You are a prompt-engineering tutor. Rewrite the QUESTION as one short Socratic question. Never write a prompt for the learner and never quote one.",
      user: `TASK BRIEF: ${brief}\nQUESTION: ${hint.question}`,
      maxTokens: 80,
    });
    spend(c.inputTokens + c.outputTokens);
    return c.text.trim() || null;
  },
};

export type TutorInput = { attemptId: string };

export const tutor: AgentDef<TutorInput, TutorHint> = {
  name: "tutor",
  goal: "Give the learner the next hint for this attempt without writing their prompt for them.",
  tools: { get_attempt: getAttempt, learner_profile: learnerProfile, count_hints: countHints, phrase_hint: phraseHint },
  maxSteps: 6,
  maxTokens: 1500,
  subjectOf: (i) => i.attemptId,
  policy(state) {
    const { attemptId } = state.input;
    if (!calls(state, "get_attempt")) return { thought: "Read the attempt first.", tool: "get_attempt", input: { attemptId } };
    if (!calls(state, "learner_profile")) return { thought: "Check the learner's habits.", tool: "learner_profile", input: {} };
    if (!calls(state, "count_hints")) return { thought: "Find where we are on the hint ladder.", tool: "count_hints", input: { attemptId } };
    const draft = buildHint(seen<AttemptView>(state, "get_attempt")!, seen<LearnerProfile>(state, "learner_profile")!, seen<number>(state, "count_hints")!);
    if (!calls(state, "phrase_hint")) return { thought: "Polish the wording.", tool: "phrase_hint", input: { hint: draft, brief: seen<AttemptView>(state, "get_attempt")!.task.brief } };
    const phrased = seen<string | null>(state, "phrase_hint");
    return { final: phrased ? { ...draft, question: phrased } : draft };
  },
  finalize(state, final) {
    const hint = final as TutorHint;
    const a = seen<AttemptView>(state, "get_attempt")!;
    // Guard: a hint must never contain the task's sample prompt or a long verbatim chunk of it.
    const sample = a.task.samplePrompt.toLowerCase().replace(/\s+/g, " ");
    const text = [hint.question, hint.explanation, hint.pattern, hint.habit].filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ");
    for (let i = 0; i + 60 <= sample.length; i += 20) {
      if (text.includes(sample.slice(i, i + 60))) throw new Error("hint would reveal the sample prompt");
    }
    if (text.length > 1200) throw new Error("hint too long");
    return hint;
  },
};

function buildHint(a: AttemptView, profile: LearnerProfile, given: number): TutorHint {
  const level = Math.min(3, given + 1) as 1 | 2 | 3;
  const failed = a.criteria.filter((c) => !c.passed).sort((x, y) => y.weight - x.weight);

  if (!failed.length) {
    const over = a.totalTokens > a.task.medianTokens;
    const tech: Coached = "length_limit";
    return {
      level, focus: "efficiency",
      question: over
        ? `Every criterion passed, but you spent ${a.totalTokens} tokens against a median of ${a.task.medianTokens}. Which parts of your prompt, or of the source you sent, did the model not need?`
        : "Every criterion passed on a lean budget. Could the same prompt work for a slightly different input without edits?",
      technique: level >= 2 && over ? { id: tech, name: COACHED[tech] } : null,
      explanation: level >= 2 && over ? "Quote only the part of the source the task is about, and cap the output — both cut tokens without hurting the score." : null,
      pattern: level >= 3 && over ? PATTERN[tech] : null,
      habit: null, lastLevel: level === 3,
    };
  }

  const top = failed[0];
  // Prefer the fix the learner rarely uses, when two failed criteria point at different techniques.
  const options = failed.slice(0, 3).map((c) => ({ c, t: techniqueFor(c.kind, a.task.domain) })).filter((o) => !a.techniques.includes(o.t));
  const pick = options.find((o) => profile.weakTechniques.includes(o.t)) ?? options[0] ?? { c: top, t: techniqueFor(top.kind, a.task.domain) };
  const t = pick.t;
  const usedPct = Math.round(100 * profile.usage[t]);
  return {
    level,
    focus: pick.c.label,
    question: `The response missed “${pick.c.label}”. Read your prompt as if you were the model: where does it ask for that?`,
    technique: level >= 2 ? { id: t, name: COACHED[t] } : null,
    explanation: level >= 2 ? WHY[t] : null,
    pattern: level >= 3 ? PATTERN[t] : null,
    habit: profile.attempts >= 3 && profile.weakTechniques.includes(t)
      ? `You've used ${COACHED[t].toLowerCase()} in ${usedPct}% of your recent attempts — it's worth making a habit.`
      : null,
    lastLevel: level === 3,
  };
}
