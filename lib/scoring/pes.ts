/**
 * Prompt Efficiency Score (paper Eqs. 1–2). Five components on a 0–1 scale:
 *   Q quality (clarity), A accuracy (task success), T tokens, L latency, C cost — higher is better.
 * The linear form rewards cheap prompts even when they fail, so the success-gated form, where the
 * resource terms count only in proportion to accuracy, is the one shown to learners.
 */

export type PesWeights = { q: number; a: number; t: number; l: number; c: number };
export const EQUAL_WEIGHTS: PesWeights = { q: 0.2, a: 0.2, t: 0.2, l: 0.2, c: 0.2 };

/** Latency at or under this counts as fully efficient; slower responses scale down from here. */
export const REFERENCE_LATENCY_MS = 2000;

const ratio = (ref: number, x: number) => (x <= 0 || ref <= 0 ? 1 : Math.min(1, ref / x));

export function pesComponents(args: {
  clarity: number; taskSuccess: number; totalTokens: number; latencyMs: number; costUsd: number;
  medianTokens: number; referenceCostUsd: number;
}) {
  return {
    q: args.clarity / 100,
    a: args.taskSuccess / 100,
    t: ratio(args.medianTokens, args.totalTokens),
    l: ratio(REFERENCE_LATENCY_MS, args.latencyMs),
    c: args.costUsd <= 0 ? 1 : ratio(args.referenceCostUsd, args.costUsd),
  };
}
export type PesComponents = ReturnType<typeof pesComponents>;

export function pesLinear(x: PesComponents, w: PesWeights = EQUAL_WEIGHTS) {
  return Math.round(100 * (w.q * x.q + w.a * x.a + w.t * x.t + w.l * x.l + w.c * x.c));
}

export function pesGated(x: PesComponents, w: PesWeights = EQUAL_WEIGHTS) {
  return Math.round(100 * (w.q * x.q + w.a * x.a + x.a * (w.t * x.t + w.l * x.l + w.c * x.c)));
}
