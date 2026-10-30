/**
 * Curriculum Planner. Builds the learner's next three tasks from their Elo rating, the item bank and
 * learner memory: tasks they have a fair chance of passing (expected score near 65%), weighted
 * towards the domains they struggle in and the techniques they rarely use.
 */
import { eq, sql } from "drizzle-orm";
import { attempts, tasks, type RubricCriterion } from "../db/schema";
import { updateRatings } from "../../scoring";
import { calls, seen, type AgentDef, type Tool } from "./core";
import { COACHED, learnerProfile, techniqueFor, type Coached, type LearnerProfile } from "./tools";

type BankItem = {
  id: string; title: string; category: string; domain: string; difficulty: string; difficultyRating: number;
  kinds: RubricCriterion["kind"][]; best: number | null; done: boolean;
};

const itemBank: Tool<Record<string, never>, { rating: number; items: BankItem[] }> = {
  description: "List active tasks with their difficulty rating, rubric criterion kinds and the learner's best score.",
  async run({ db, user }) {
    const rows = await db.select().from(tasks).where(eq(tasks.active, true));
    const best = await db
      .select({ taskId: attempts.taskId, best: sql<number>`max(${attempts.taskSuccess})` })
      .from(attempts)
      .where(eq(attempts.userId, user.id))
      .groupBy(attempts.taskId);
    const by = new Map(best.map((b) => [b.taskId, b]));
    return {
      rating: user.rating,
      items: rows.map((t) => {
        const b = by.get(t.id);
        return {
          id: t.id, title: t.title, category: t.category, domain: t.domain, difficulty: t.difficulty, difficultyRating: t.difficultyRating,
          kinds: t.rubric.map((c) => c.kind), best: b ? Number(b.best) : null, done: !!b && Number(b.best) >= 85, // already at certification level
        };
      }),
    };
  },
};

export type PlanItem = { taskId: string; title: string; category: string; expected: number; practises: { id: Coached; name: string } | null; reason: string };
export type Plan = { rating: number; focus: { id: Coached; name: string } | null; items: PlanItem[] };

export const curriculumPlanner: AgentDef<Record<string, never>, Plan> = {
  name: "curriculum_planner",
  goal: "Choose the learner's next three tasks and say why each one was chosen.",
  tools: { learner_profile: learnerProfile, item_bank: itemBank },
  maxSteps: 4,
  maxTokens: 1000,
  subjectOf: () => null,
  policy(state) {
    if (!calls(state, "learner_profile")) return { thought: "Recall the learner's habits.", tool: "learner_profile", input: {} };
    if (!calls(state, "item_bank")) return { thought: "Look at the item bank.", tool: "item_bank", input: {} };
    return { final: plan(seen<LearnerProfile>(state, "learner_profile")!, seen<{ rating: number; items: BankItem[] }>(state, "item_bank")!) };
  },
  finalize: (_state, final) => final as Plan,
};

function plan(profile: LearnerProfile, bank: { rating: number; items: BankItem[] }): Plan {
  const pool = bank.items.filter((i) => !i.done);
  // Focus on the least-used technique that the remaining tasks actually exercise.
  const practisable = new Set((pool.length ? pool : bank.items).flatMap((i) => i.kinds.map((k) => techniqueFor(k, i.domain as never))));
  const focus = profile.attempts >= 3 ? profile.weakTechniques.find((t) => practisable.has(t)) ?? null : null;
  const scored = (pool.length ? pool : bank.items).map((i) => {
    const expected = updateRatings(bank.rating, i.difficultyRating, 0).expected;
    const practises = i.kinds.map((k) => techniqueFor(k, i.domain as never)).find((t) => profile.weakTechniques.includes(t)) ?? null;
    const weakDomain = profile.weakDomains.includes(i.domain);
    // Closest to a 65% expected score, nudged towards weak domains, weak techniques and unstarted tasks.
    const utility = -Math.abs(expected - 0.65) + (weakDomain ? 0.08 : 0) + (practises ? 0.05 : 0) + (practises === focus && focus ? 0.05 : 0) + (i.best === null ? 0.02 : 0);
    return { i, expected, practises, weakDomain, utility };
  });
  scored.sort((a, b) => b.utility - a.utility);
  const items = scored.slice(0, 3).map(({ i, expected, practises, weakDomain }) => {
    const why: string[] = [];
    const pct = Math.round(expected * 100);
    why.push(pct >= 75 ? `a confident step at your level (≈${pct}% expected)` : pct >= 50 ? `a fair stretch for your rating (≈${pct}% expected)` : `a hard stretch (≈${pct}% expected)`);
    if (weakDomain) why.push(`${i.category.toLowerCase()} is where your scores are lowest`);
    if (practises) why.push(`it rewards ${COACHED[practises].toLowerCase()}, which you rarely use`);
    if (i.best !== null) why.push(`your best so far is ${i.best}`);
    return {
      taskId: i.id, title: i.title, category: i.category, expected: pct,
      practises: practises ? { id: practises, name: COACHED[practises] } : null,
      reason: why.join("; ").replace(/^./, (c) => c.toUpperCase()) + ".",
    };
  });
  return { rating: Math.round(bank.rating), focus: focus ? { id: focus, name: COACHED[focus] } : null, items };
}
