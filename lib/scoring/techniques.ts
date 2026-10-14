/**
 * Detects which prompting techniques a user's prompt employs. Heuristic, transparent, and
 * aligned with the six techniques studied in our paper ("How Many Parameters Is a Prompt Worth?").
 */
import type { DetectedTechnique } from "../server/db/schema";

const T = {
  fewShot: { id: "few_shot", name: "Few-shot examples" },
  cot: { id: "chain_of_thought", name: "Chain-of-thought" },
  role: { id: "role", name: "Role / persona" },
  structured: { id: "structured", name: "Structured output" },
  answerOnly: { id: "answer_only", name: "Answer-only constraint" },
  audience: { id: "audience", name: "Named audience" },
  lengthLimit: { id: "length_limit", name: "Length constraint" },
  stepList: { id: "numbered_asks", name: "Numbered asks" },
} as const;

function find(prompt: string, re: RegExp) {
  const m = prompt.match(re);
  return m ? m[0].trim().slice(0, 80) : null;
}

export function detectTechniques(prompt: string): DetectedTechnique[] {
  const p = prompt;
  const out: DetectedTechnique[] = [];
  const add = (t: { id: string; name: string }, evidence: string | null) => evidence && out.push({ ...t, evidence });

  const exampleMarkers = p.match(/(^|\n)\s*(example\s*\d*\s*[:.)-]|e\.g\.,?\s*input|input\s*:|q\s*:)/gi) ?? [];
  add(T.fewShot, exampleMarkers.length >= 2 ? `${exampleMarkers.length} worked examples (“${exampleMarkers[0].trim()}”)` : null);

  add(T.cot, find(p, /(let'?s think step by step|step[- ]by[- ]step|think (it )?through|show (your )?(work|reasoning)|reason (it )?out|explain your reasoning)/i));
  add(T.role, find(p, /(^|\n|\.\s)\s*(you are|you're|act as|pretend (to be|you are)|as an? (expert|senior|experienced))\b[^.\n]{0,60}/i));
  add(T.structured, find(p, /(respond (only )?(in|with|as)\b[^.\n]{0,40}|return (json|a json|only)[^.\n]{0,30}|\bjson\b|format\s*:|use (this|the following) (format|template)|keys?\s*:)/i));
  add(T.answerOnly, find(p, /(only (give|return|output|respond with) (the )?(final )?answer|answer only|no (explanation|working|reasoning)|do not explain|don'?t explain|just (the )?answer)/i));
  add(T.audience, find(p, /(for an? [a-z-]+( [a-z-]+){0,3} (who|reader|audience|non-)|non-(lawyer|technical|expert|engineer)|(reader|audience) is|explain (it )?to an? )/i));
  add(T.lengthLimit, find(p, /(under|at most|no more than|max(imum)?|within|fewer than)\s+\d+\s*(words?|sentences?|bullets?|lines?|characters?|tokens?)|\b(one|two|three|\d+) (short )?(sentences?|bullets?|lines?)\b/i));
  const numbered = p.match(/(^|\n)\s*\d+[.)]\s+\S/g) ?? [];
  add(T.stepList, numbered.length >= 2 ? `${numbered.length} numbered requirements` : null);
  return out;
}

export const has = (ts: DetectedTechnique[], id: string) => ts.some((t) => t.id === id);
