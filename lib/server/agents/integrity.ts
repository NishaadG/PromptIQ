/**
 * Integrity Reviewer. Gathers the evidence on a flagged attempt and proposes a decision — exclude it
 * from certification evidence, or clear the flag. It never decides: the proposal waits for an admin,
 * and only an approved proposal is written back to the attempt.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { attempts, tasks, users, type IntegrityInfo } from "../db/schema";
import { MAX_HUMAN_CPS } from "../../scoring/integrity";
import { AgentError, calls, seen, type AgentDef, type Tool } from "./core";

type Flagged = {
  attemptId: string; userId: string; handle: string; taskTitle: string; taskSuccess: number; promptChars: number;
  integrity: IntegrityInfo; sampleSimilarity: number;
};
type LearnerRecord = { otherAttempts: number; meanSuccess: number | null; otherFlagged: number; rating: number };

/** Word-set overlap (Jaccard) between the prompt and the task's sample prompt. */
function similarity(a: string, b: string) {
  const w = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const x = w(a), y = w(b);
  const inter = [...x].filter((t) => y.has(t)).length;
  return x.size + y.size - inter ? inter / (x.size + y.size - inter) : 0;
}

const getFlaggedAttempt: Tool<{ attemptId: string }, Flagged> = {
  description: "Load a flagged attempt: its integrity signals, score, and how closely the prompt matches the task's sample prompt.",
  async run({ db }, { attemptId }) {
    const [r] = await db
      .select({ a: attempts, handle: users.handle, title: tasks.title, sample: tasks.samplePrompt })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .innerJoin(tasks, eq(tasks.id, attempts.taskId))
      .where(eq(attempts.id, attemptId))
      .limit(1);
    if (!r) throw new AgentError(404, "Attempt not found");
    if (!r.a.integrity.flags.length) throw new AgentError(400, "This attempt has no integrity flags");
    return {
      attemptId, userId: r.a.userId, handle: r.handle, taskTitle: r.title, taskSuccess: r.a.taskSuccess, promptChars: r.a.prompt.length,
      integrity: r.a.integrity, sampleSimilarity: Math.round(100 * similarity(r.a.prompt, r.sample)) / 100,
    };
  },
};

const learnerRecord: Tool<{ userId: string; excludeAttemptId: string }, LearnerRecord> = {
  description: "Summarise the learner's other attempts: count, mean score, how many were flagged, and their rating.",
  async run({ db }, { userId, excludeAttemptId }) {
    const [agg] = await db
      .select({
        n: sql<number>`count(*)`, mean: sql<number | null>`round(avg(${attempts.taskSuccess}))`,
        flagged: sql<number>`count(*) filter (where jsonb_array_length(${attempts.integrity}->'flags') > 0)`,
      })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), ne(attempts.id, excludeAttemptId)));
    const [u] = await db.select({ rating: users.rating }).from(users).where(eq(users.id, userId)).limit(1);
    return { otherAttempts: Number(agg.n), meanSuccess: agg.mean === null ? null : Number(agg.mean), otherFlagged: Number(agg.flagged), rating: Math.round(u?.rating ?? 1000) };
  },
};

export type IntegrityProposal = {
  attemptId: string; handle: string; taskTitle: string; flags: string[];
  evidence: string[]; recommendation: "exclude" | "clear"; confidence: "low" | "medium" | "high"; summary: string;
};

export const integrityReviewer: AgentDef<{ attemptId: string }, IntegrityProposal> = {
  name: "integrity_reviewer",
  goal: "Prepare the evidence on a flagged attempt and propose whether it should count towards certification.",
  tools: { get_flagged_attempt: getFlaggedAttempt, learner_record: learnerRecord },
  maxSteps: 4,
  maxTokens: 1000,
  requiresApproval: true,
  subjectOf: (i) => i.attemptId,
  policy(state) {
    if (!calls(state, "get_flagged_attempt")) return { thought: "Load the flagged attempt.", tool: "get_flagged_attempt", input: { attemptId: state.input.attemptId } };
    const f = seen<Flagged>(state, "get_flagged_attempt")!;
    if (!calls(state, "learner_record")) return { thought: "Compare with the learner's record.", tool: "learner_record", input: { userId: f.userId, excludeAttemptId: f.attemptId } };
    return { final: propose(f, seen<LearnerRecord>(state, "learner_record")!) };
  },
  finalize: (_s, final) => final as IntegrityProposal,
  async apply({ db, user }, proposal, run) {
    const [a] = await db.select({ integrity: attempts.integrity }).from(attempts).where(eq(attempts.id, proposal.attemptId)).limit(1);
    if (!a) throw new AgentError(404, "Attempt no longer exists");
    const review = { decision: proposal.recommendation, runId: run.id, by: user.id, at: new Date().toISOString() };
    await db.update(attempts).set({ integrity: { ...a.integrity, review } }).where(eq(attempts.id, proposal.attemptId));
  },
};

function propose(f: Flagged, r: LearnerRecord): IntegrityProposal {
  const ev: string[] = [];
  const { flags, elapsedMs, pastedChars = 0 } = f.integrity;
  const typed = Math.max(0, f.promptChars - Math.min(pastedChars, f.promptChars));
  const cps = elapsedMs ? typed / (elapsedMs / 1000) : null;
  if (cps !== null) ev.push(`${typed} typed characters in ${(elapsedMs! / 1000).toFixed(1)} s (${cps.toFixed(1)} chars/s; human ceiling ≈ ${MAX_HUMAN_CPS}).`);
  if (pastedChars) ev.push(`${pastedChars} of ${f.promptChars} characters arrived by paste or the sample-prompt button.`);
  ev.push(`Prompt overlaps the task's sample prompt by ${Math.round(f.sampleSimilarity * 100)}%.`);
  ev.push(r.otherAttempts
    ? `Other attempts: ${r.otherAttempts}, mean score ${r.meanSuccess}, ${r.otherFlagged} flagged. Rating ${r.rating}.`
    : "This is the learner's only attempt.");

  const implausible = flags.includes("implausible_typing_speed");
  const repeat = r.otherFlagged >= 2;
  const consistent = r.meanSuccess !== null && f.taskSuccess - r.meanSuccess <= 15;

  let recommendation: "exclude" | "clear";
  let confidence: "low" | "medium" | "high";
  let summary: string;
  if (implausible) {
    recommendation = "exclude";
    confidence = cps !== null && cps > 2 * MAX_HUMAN_CPS ? "high" : "medium";
    summary = "Typing speed is beyond what a person can sustain, so the prompt was most likely generated or injected. Exclude it from certification evidence; practice scores are unaffected.";
  } else if (flags.includes("sudden_jump") && !consistent && repeat) {
    recommendation = "exclude";
    confidence = "low";
    summary = "An unexpected jump in score, from a learner with several other flagged attempts. Worth a closer look before it counts.";
  } else {
    recommendation = "clear";
    confidence = consistent || !flags.includes("sudden_jump") ? "high" : "medium";
    summary = flags.includes("mostly_pasted") && f.sampleSimilarity > 0.8
      ? "The prompt is mostly the task's own sample prompt, inserted with the button the platform provides. That is allowed; clear the flag."
      : "The signals are informational and nothing else in the record is unusual. Clear the flag.";
  }
  return { attemptId: f.attemptId, handle: f.handle, taskTitle: f.taskTitle, flags, evidence: ev, recommendation, confidence, summary };
}
