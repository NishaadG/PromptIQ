import { describe, expect, it } from "vitest";
import { detectTechniques } from "@/lib/scoring/techniques";
import { evaluateCriterion, rubricScore } from "@/lib/scoring/rubric";
import { clarityScore, efficiencyScore } from "@/lib/scoring/metrics";
import { computeReward, levelFromXp, nextStreak, updateRatings } from "@/lib/scoring/progression";
import { buildFeedback } from "@/lib/scoring/feedback";
import { countTokens } from "@/lib/scoring/tokens";

const ids = (p: string) => detectTechniques(p).map((t) => t.id);

describe("technique detection", () => {
  it("detects the six study techniques and constraints", () => {
    expect(ids("You are an expert maths teacher. Solve this.")).toContain("role");
    expect(ids("Let's think step by step.")).toContain("chain_of_thought");
    expect(ids("Example 1: a -> b\nExample 2: c -> d\nNow do e")).toContain("few_shot");
    expect(ids("Return only JSON with keys a, b.")).toContain("structured");
    expect(ids("Give only the final answer, no explanation.")).toContain("answer_only");
    expect(ids("Explain it for a non-lawyer who reads on a phone, under 40 words.")).toEqual(expect.arrayContaining(["audience", "length_limit"]));
  });
  it("does not flag a plain prompt", () => {
    expect(ids("Summarize the clause.")).toEqual([]);
  });
});

describe("rubric", () => {
  it("evaluates each criterion kind", () => {
    expect(evaluateCriterion({ kind: "includes_any", label: "x", terms: ["Plan B"], weight: 1 }, "choose plan b")!.passed).toBe(true);
    expect(evaluateCriterion({ kind: "excludes", label: "x", terms: ["refund"], weight: 1 }, "full refund")!.passed).toBe(false);
    expect(evaluateCriterion({ kind: "max_words", label: "x", max: 3, weight: 1 }, "one two three four")!.passed).toBe(false);
    expect(evaluateCriterion({ kind: "min_items", label: "x", min: 3, weight: 1 }, "- a\n- b\n- c")!.passed).toBe(true);
    expect(evaluateCriterion({ kind: "regex", label: "x", pattern: "1,?068", weight: 1 }, "$1,068 per year")!.passed).toBe(true);
    const json = '```json\n{"total_due": 3350, "currency": "usd"}\n```';
    expect(evaluateCriterion({ kind: "json_fields", label: "x", fields: { total_due: 3350, currency: "USD" }, weight: 1 }, json)!.passed).toBe(true);
    expect(evaluateCriterion({ kind: "json_fields", label: "x", fields: { total_due: 1 }, weight: 1 }, "no json here")!.passed).toBe(false);
    expect(evaluateCriterion({ kind: "llm_judge", label: "x", question: "?", weight: 1 }, "anything")).toBeNull();
  });
  it("weights the score", () => {
    expect(rubricScore([{ label: "a", passed: true, weight: 3 }, { label: "b", passed: false, weight: 1 }])).toBe(75);
  });
});

describe("metrics", () => {
  it("efficiency rewards spending fewer tokens than the median", () => {
    expect(efficiencyScore(80, 600, 600)).toBe(80);
    expect(efficiencyScore(80, 300, 600)).toBeGreaterThan(80);
    expect(efficiencyScore(80, 1200, 600)).toBeLessThan(80);
    expect(efficiencyScore(100, 100, 600)).toBeLessThanOrEqual(100);
  });
  it("clarity prefers plain, short sentences", () => {
    const plain = "- You pay if anyone sues.\n- That includes their mistakes.\n- Ask them to remove that line.";
    const dense = "Notwithstanding the foregoing indemnification obligations, the Customer shall comprehensively and unconditionally indemnify, defend and hold harmless the Supplier and its affiliates, officers, directors, employees, agents, successors and assigns from and against any and all liabilities.";
    expect(clarityScore(plain)).toBeGreaterThan(clarityScore(dense));
  });
  it("counts real tokens", () => {
    expect(countTokens("hello world")).toBeGreaterThan(0);
    expect(countTokens("")).toBe(0);
  });
});

describe("progression", () => {
  it("levels follow sqrt(xp/50)+1", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(50).level).toBe(2);
    expect(levelFromXp(2340).level).toBe(7);
    expect(levelFromXp(2340).title).toBe("Practitioner");
  });
  it("rewards require a passing score", () => {
    expect(computeReward(100, 90, 80)).toEqual({ reward: 100, bonus: 20 });
    expect(computeReward(100, 40, 90)).toEqual({ reward: 20, bonus: 0 });
  });
  it("streaks continue on consecutive days and reset after a gap", () => {
    const now = new Date("2026-10-15T10:00:00Z");
    expect(nextStreak({ currentStreak: 4, longestStreak: 4, lastActiveDay: "2026-10-14" }, now).currentStreak).toBe(5);
    expect(nextStreak({ currentStreak: 4, longestStreak: 9, lastActiveDay: "2026-10-10" }, now)).toMatchObject({ currentStreak: 1, longestStreak: 9 });
    expect(nextStreak({ currentStreak: 4, longestStreak: 4, lastActiveDay: "2026-10-15" }, now).currentStreak).toBe(4);
  });
  it("ratings move toward performance", () => {
    expect(updateRatings(1000, 1000, 100).user).toBeGreaterThan(1000);
    expect(updateRatings(1000, 1000, 0).user).toBeLessThan(1000);
  });
});

describe("research-backed feedback", () => {
  const base = { tokenBudget: 600, medianTokens: 500, context: "x" };
  it("warns about the answer-only compliance trap on reasoning tasks", () => {
    const prompt = "Give only the final answer, no explanation.";
    const fb = buildFeedback({ task: { ...base, domain: "reasoning" }, prompt, promptTokens: 20, totalTokens: 40, techniques: detectTechniques(prompt), criteria: [], taskSuccess: 50 });
    expect(fb.some((f) => f.kind === "warn" && /answer only/i.test(f.text))).toBe(true);
  });
  it("flags the cost of few-shot examples", () => {
    const prompt = "Example 1: a\nExample 2: b\nNow c";
    const fb = buildFeedback({ task: { ...base, domain: "summarization" }, prompt, promptTokens: 20, totalTokens: 40, techniques: detectTechniques(prompt), criteria: [], taskSuccess: 80 });
    expect(fb.some((f) => f.kind === "cost" && /few-shot/i.test(f.text))).toBe(true);
  });
});
