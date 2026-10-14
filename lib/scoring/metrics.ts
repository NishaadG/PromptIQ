/**
 * Efficiency and clarity metrics. Efficiency follows the same idea as our paper's NCEG: accuracy
 * only counts as "efficient" once you pay for the tokens it took.
 */

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/**
 * Efficiency (0–100): task success scaled by token spend relative to the task's median solver.
 * Spending exactly the median keeps efficiency = success; half the median → ×1.33; double → ×0.67.
 */
export function efficiencyScore(taskSuccess: number, totalTokens: number, medianTokens: number): number {
  if (totalTokens <= 0 || medianTokens <= 0) return clamp(taskSuccess);
  const factor = 2 / (1 + totalTokens / medianTokens);
  return Math.round(clamp(taskSuccess * factor));
}

function syllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * Clarity (0–100): reader-fit of the model's response — Flesch reading ease, penalised for very
 * long sentences, rewarded for scannable structure (bullets / short paragraphs).
 */
export function clarityScore(text: string): number {
  const plain = text.replace(/```[\s\S]*?```/g, " ").replace(/[*_#>`]/g, "");
  const sentences = plain.split(/[.!?]+(?:\s|$)|\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3);
  const words = plain.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  if (!sentences.length || !words.length) return 50;
  const wps = words.length / sentences.length;
  const spw = words.reduce((s, w) => s + syllables(w), 0) / words.length;
  const flesch = 206.835 - 1.015 * wps - 84.6 * spw; // ~30 = hard, ~70 = plain English
  let score = clamp(((flesch - 10) / 70) * 100);
  const longest = Math.max(...sentences.map((s) => s.split(/\s+/).length));
  if (longest > 40) score -= 10;
  if (/(^|\n)\s*([-*•]|\d+[.)])\s+/.test(text)) score += 8;
  return Math.round(clamp(score));
}
