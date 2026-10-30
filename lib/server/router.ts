/**
 * AI Model Routing Engine (paper Eq. 3): R_m = αQ_m − βC_m − γL_m − δP_m, highest score wins.
 * Q is task success, C and L are cost and latency scaled to [0, 1] against fixed references, and
 * P is 1 when a model outside the platform would see personal data.
 */

export type RouteWeights = { alpha: number; beta: number; gamma: number; delta: number };
/** Quality-first operating point used in the paper (α = 0.7, the rest split 0.4 : 0.2 : 0.4). */
export const DEFAULT_ROUTE_WEIGHTS: RouteWeights = { alpha: 0.7, beta: 0.12, gamma: 0.06, delta: 0.12 };

/** Latency at which the latency term saturates. */
export const LATENCY_CAP_MS = 10_000;

export type RouteCandidate = { id: "local" | "cloud"; taskSuccess: number; costUsd: number; latencyMs: number; external: boolean };
export type RouteScore = { id: "local" | "cloud"; score: number; q: number; c: number; l: number; p: number };

export function routeScores(
  candidates: RouteCandidate[], ctx: { personalData: boolean; budgetCostUsd: number }, w: RouteWeights = DEFAULT_ROUTE_WEIGHTS,
): RouteScore[] {
  return candidates.map((m) => {
    const q = m.taskSuccess / 100;
    const c = ctx.budgetCostUsd > 0 ? Math.min(1, m.costUsd / ctx.budgetCostUsd) : 0;
    const l = Math.min(1, m.latencyMs / LATENCY_CAP_MS);
    const p = m.external && ctx.personalData ? 1 : 0;
    return { id: m.id, q, c, l, p, score: w.alpha * q - w.beta * c - w.gamma * l - w.delta * p };
  });
}

export function route(candidates: RouteCandidate[], ctx: { personalData: boolean; budgetCostUsd: number }, w = DEFAULT_ROUTE_WEIGHTS) {
  const scores = routeScores(candidates, ctx, w);
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const other = scores.find((s) => s.id !== best.id);
  return { pick: best.id, scores, reasons: explain(best, other, ctx.personalData) };
}

function explain(best: RouteScore, other: RouteScore | undefined, personalData: boolean): string[] {
  const out: string[] = [];
  if (!other) return out;
  const gap = Math.round(100 * (best.q - other.q));
  if (best.id === "local") {
    if (personalData && other.p) out.push("The task contains personal data, so the router keeps it on the local model.");
    out.push(gap >= 0 ? "The local model scored as well as the cloud model, at no marginal cost." : `The local model trailed by ${-gap} points, which the saving in cost outweighs at these weights.`);
  } else {
    out.push(`The cloud model scored ${gap} points higher, enough to outweigh its cost${personalData ? " and the privacy penalty" : ""} at these weights.`);
  }
  return out;
}
