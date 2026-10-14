import type { RubricCriterion } from "../server/db/schema";
import { countWords } from "./tokens";

export type CriterionResult = { label: string; passed: boolean; weight: number; detail?: string };

const norm = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidates = [fenced, text.match(/\{[\s\S]*\}/)?.[0]].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {}
  }
  return null;
}

function countItems(text: string) {
  const bullets = text.match(/(^|\n)\s*([-*•]|\d+[.)])\s+\S/g)?.length ?? 0;
  if (bullets) return bullets;
  return text.split(/\n\s*\n/).filter((x) => x.trim()).length;
}

/**
 * Evaluates deterministic rubric criteria against the model response. `llm_judge` criteria are
 * resolved by the caller (they need a model); here they are returned as `null` = not evaluated.
 */
export function evaluateCriterion(c: RubricCriterion, response: string): CriterionResult | null {
  const r = norm(response);
  switch (c.kind) {
    case "includes_any": {
      const hit = c.terms.find((t) => r.includes(norm(t)));
      return { label: c.label, weight: c.weight, passed: !!hit, detail: hit ? `mentions “${hit}”` : "key point missing" };
    }
    case "includes_all": {
      const missing = c.terms.filter((t) => !r.includes(norm(t)));
      return { label: c.label, weight: c.weight, passed: !missing.length, detail: missing.length ? `missing: ${missing.join(", ")}` : undefined };
    }
    case "excludes": {
      const hit = c.terms.find((t) => r.includes(norm(t)));
      return { label: c.label, weight: c.weight, passed: !hit, detail: hit ? `contains “${hit}”` : undefined };
    }
    case "max_words": {
      const n = countWords(response);
      return { label: c.label, weight: c.weight, passed: n <= c.max, detail: `${n} words (limit ${c.max})` };
    }
    case "min_items": {
      const n = countItems(response);
      return { label: c.label, weight: c.weight, passed: n >= c.min, detail: `${n} items` };
    }
    case "json_fields": {
      const obj = extractJson(response);
      if (!obj) return { label: c.label, weight: c.weight, passed: false, detail: "no valid JSON object found" };
      const wrong = Object.entries(c.fields).filter(([k, v]) => {
        const got = obj[k];
        return typeof v === "string" && typeof got === "string" ? norm(got) !== norm(v) : got !== v;
      });
      return { label: c.label, weight: c.weight, passed: !wrong.length, detail: wrong.length ? `wrong/missing: ${wrong.map(([k]) => k).join(", ")}` : undefined };
    }
    case "regex": {
      const ok = new RegExp(c.pattern, c.flags ?? "i").test(response);
      return { label: c.label, weight: c.weight, passed: ok };
    }
    case "llm_judge":
      return null;
  }
}

/** Weighted pass rate (0–100) over the criteria that were evaluated. */
export function rubricScore(results: CriterionResult[]): number {
  const total = results.reduce((s, r) => s + r.weight, 0);
  if (!total) return 0;
  return Math.round((100 * results.reduce((s, r) => s + (r.passed ? r.weight : 0), 0)) / total);
}
