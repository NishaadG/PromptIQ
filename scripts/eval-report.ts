/**
 * Offline evaluation used for the technical report. Measures, with the production code paths:
 *  1. technique detection precision / recall / F1 on a hand-labelled prompt set,
 *  2. score separation between expert, average and lazy prompts on all 10 item-bank tasks,
 *  3. "skilled prompt on a small model vs lazy prompt on a large model" (Local Lab thesis),
 *  4. certificate tamper detection over random mutations,
 *  5. integrity-signal accuracy on synthetic sessions,
 *  6. scoring-engine latency.
 * Model responses come from the deterministic simulated providers (no API keys needed).
 *
 *   npx tsx scripts/eval-report.ts [out.json]
 */
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { SEED_TASKS } from "../lib/server/db/seed-data";
import type { Task } from "../lib/server/db/schema";
import { composeUserMessage, simulatedProvider, simulatedSmallProvider } from "../lib/server/llm";
import { scoreAttempt, detectTechniques } from "../lib/scoring";
import { integritySignals } from "../lib/scoring/integrity";
import { AVERAGE_PROMPTS, LAZY_PROMPT } from "../lib/scoring/reference-prompts";
import { signPayload, verifyPayload } from "../lib/server/credentials/signing";

const tasks = SEED_TASKS.map((t) => ({ ...t, active: true, createdAt: new Date() })) as unknown as Task[];
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

/* ------------------------------------------------------------ 1. technique detection */

type L = "few_shot" | "chain_of_thought" | "role" | "structured" | "answer_only" | "audience" | "length_limit" | "numbered_asks";
const LABELS: L[] = ["few_shot", "chain_of_thought", "role", "structured", "answer_only", "audience", "length_limit", "numbered_asks"];

// Hand-labelled by the authors: which techniques a human reviewer would say each prompt uses.
const LABELLED: [string, L[]][] = [
  ["Summarize this.", []],
  ["Can you help me with the text below?", []],
  ["What does this contract say?", []],
  ["Fix the bugs in this code.", []],
  ["Translate the paragraph into French.", []],
  ["Tell me about the meeting notes.", []],
  ["You are a senior Python engineer. Review this function.", ["role"]],
  ["Act as a strict editor and tighten this paragraph.", ["role"]],
  ["Pretend you are a tax advisor and explain the deduction.", ["role"]],
  ["As an experienced recruiter, rank these CVs.", ["role"]],
  ["Imagine you're a kindergarten teacher explaining gravity.", ["role"]],
  ["Let's think step by step about which plan is cheaper.", ["chain_of_thought"]],
  ["Work through the problem step-by-step before answering.", ["chain_of_thought"]],
  ["Show your reasoning, then give the total.", ["chain_of_thought"]],
  ["Think it through carefully and explain your reasoning.", ["chain_of_thought"]],
  ["Break the calculation down into intermediate steps first.", ["chain_of_thought"]],
  ["Return only JSON with keys name, total and currency.", ["structured"]],
  ["Respond in a markdown table with columns Item and Price.", ["structured"]],
  ["Use the following format:\nDecision: ...\nOwner: ...", ["structured"]],
  ["Output a CSV with one row per ticket.", ["structured"]],
  ["Give only the final answer, no explanation.", ["answer_only"]],
  ["Just the answer please.", ["answer_only"]],
  ["Do not explain, reply with the number only.", ["answer_only"]],
  ["Explain this to a non-technical manager.", ["audience"]],
  ["Write it for a 10-year-old reader.", ["audience"]],
  ["The audience is first-year nursing students.", ["audience"]],
  ["Explain it to a customer who isn't an engineer.", ["audience"]],
  ["Keep it under 50 words.", ["length_limit"]],
  ["Answer in no more than three sentences.", ["length_limit"]],
  ["Write two short bullets.", ["length_limit"]],
  ["Keep the reply brief, a tweet at most.", ["length_limit"]],
  ["Do three things:\n1. List the risks\n2. Rank them\n3. Suggest one fix", ["numbered_asks"]],
  ["Please:\n1) find the total\n2) find the due date", ["numbered_asks"]],
  ["Example 1: 'refund please' -> billing\nExample 2: 'app crashes' -> bug\nNow classify: 'add dark mode'", ["few_shot"]],
  ["Q: 2+2? A: 4\nQ: 3+5? A: 8\nQ: 7+6? A:", ["few_shot"]],
  ["Input: hot -> Output: cold\nInput: tall -> Output: short\nInput: fast ->", ["few_shot"]],
  ["Here's one example of the tone I want: 'Thanks for flagging this!' Now rewrite the reply.", ["few_shot"]],
  ["You are a contracts lawyer. Explain the clause for a non-lawyer in under 60 words.", ["role", "audience", "length_limit"]],
  ["Classify each ticket. Return only JSON, e.g. {\"T1\": \"bug\"}. No explanation.", ["structured", "answer_only"]],
  ["Think step by step, then give the final answer in JSON with key answer.", ["chain_of_thought", "structured"]],
  ["For a busy CFO, summarise in three bullets:\n1. cost\n2. risk\n3. recommendation", ["audience", "length_limit", "numbered_asks"]],
  ["Act as a support lead. Rewrite this for a frustrated customer, under 100 words.", ["role", "audience", "length_limit"]],
  ["You're helping a small-business owner who isn't a lawyer. Explain the clause in three short bullets.", ["audience", "length_limit"]],
  ["Review the function for bugs. List each as a numbered item with a one-line fix. Under 120 words.", ["length_limit"]],
  ["Compare both plans. Show the arithmetic briefly, then a final line with the cheaper plan.", ["chain_of_thought", "structured"]],
  ["Answer using only the policy below, in plain language for a staff member, under 80 words.", ["audience", "length_limit"]],
  ["Example: input 'late fee' -> billing. Example: input 'login fails' -> account. Classify the rest as JSON.", ["few_shot", "structured"]],
  ["As an expert statistician, explain p-values to a high-school student step by step.", ["role", "audience", "chain_of_thought"]],
];

function techniqueEval() {
  const per: Record<string, { tp: number; fp: number; fn: number }> = {};
  for (const l of LABELS) per[l] = { tp: 0, fp: 0, fn: 0 };
  let exact = 0;
  const misses: { prompt: string; expected: string[]; got: string[] }[] = [];
  for (const [prompt, gold] of LABELLED) {
    const got = detectTechniques(prompt).map((t) => t.id as L).filter((id) => LABELS.includes(id));
    for (const l of LABELS) {
      const g = gold.includes(l), p = got.includes(l);
      if (g && p) per[l].tp++; else if (!g && p) per[l].fp++; else if (g && !p) per[l].fn++;
    }
    const same = gold.length === got.length && gold.every((g) => got.includes(g));
    if (same) exact++; else misses.push({ prompt: prompt.slice(0, 70), expected: gold, got });
  }
  const rows = LABELS.map((l) => {
    const { tp, fp, fn } = per[l];
    const precision = tp + fp ? tp / (tp + fp) : 1, recall = tp + fn ? tp / (tp + fn) : 1;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { technique: l, support: tp + fn, tp, fp, fn, precision: round(precision, 3), recall: round(recall, 3), f1: round(f1, 3) };
  });
  const sum = (k: "tp" | "fp" | "fn") => rows.reduce((a, r) => a + r[k], 0);
  const P = sum("tp") / (sum("tp") + sum("fp")), R = sum("tp") / (sum("tp") + sum("fn"));
  return {
    prompts: LABELLED.length, labels: sum("tp") + sum("fn"), rows,
    micro: { precision: round(P, 3), recall: round(R, 3), f1: round((2 * P * R) / (P + R), 3) },
    macroF1: round(mean(rows.map((r) => r.f1)), 3),
    exactMatch: round(exact / LABELLED.length, 3), misses,
  };
}

/* ------------------------------------------------------------ 2. score separation */

const AVERAGE = AVERAGE_PROMPTS;
const LAZY = LAZY_PROMPT;

async function run(provider: typeof simulatedProvider, task: Task, prompt: string) {
  const c = await provider.complete({ user: composeUserMessage(prompt, task.context), maxTokens: task.tokenBudget, task, learnerPrompt: prompt });
  const s = scoreAttempt({ task, prompt, response: c.text, promptTokens: c.inputTokens, outputTokens: c.outputTokens });
  return { success: s.taskSuccess, efficiency: s.efficiency, clarity: s.clarity, tokens: s.totalTokens, feedback: s.feedback.length };
}

async function separationEval() {
  type Run = Awaited<ReturnType<typeof run>>;
  const rows: { task: string; domain: string; medianTokens: number; expert: Run; average: Run; lazy: Run }[] = [];
  for (const t of tasks) {
    const expert = await run(simulatedProvider, t, t.samplePrompt);
    const average = await run(simulatedProvider, t, AVERAGE[t.domain]);
    const lazy = await run(simulatedProvider, t, LAZY);
    rows.push({ task: t.id, domain: t.domain, medianTokens: t.medianTokens, expert, average, lazy });
  }
  const agg = (k: "expert" | "average" | "lazy", f: "success" | "efficiency" | "clarity" | "tokens") => {
    const xs = rows.map((r) => r[k][f]);
    return { mean: round(mean(xs)), sd: round(sd(xs)) };
  };
  const tiers = (["expert", "average", "lazy"] as const).map((k) => ({
    tier: k, success: agg(k, "success"), efficiency: agg(k, "efficiency"), clarity: agg(k, "clarity"), tokens: agg(k, "tokens"),
  }));
  const ordered = rows.filter((r) => r.expert.success >= r.average.success && r.average.success >= r.lazy.success).length;
  const expertBeatsLazy = rows.filter((r) => r.expert.success > r.lazy.success).length;
  const passRate = (k: "expert" | "average" | "lazy") => round(rows.filter((r) => r[k].success >= 85).length / rows.length, 3);
  return { rows, tiers, orderedTasks: ordered, expertBeatsLazy, passRate: { expert: passRate("expert"), average: passRate("average"), lazy: passRate("lazy") } };
}

/* ------------------------------------------------------------ 3. Local Lab */

async function labEval() {
  const rows = [];
  for (const t of tasks) {
    const skilledSmall = await run(simulatedSmallProvider, t, t.samplePrompt);
    const lazyLarge = await run(simulatedProvider, t, AVERAGE[t.domain]);
    const skilledLarge = await run(simulatedProvider, t, t.samplePrompt);
    rows.push({ task: t.id, domain: t.domain, skilledSmall: skilledSmall.success, skilledLarge: skilledLarge.success, lazyLarge: lazyLarge.success });
  }
  return {
    rows,
    smallMatchesOrBeatsLazyLarge: rows.filter((r) => r.skilledSmall >= r.lazyLarge).length,
    smallWithin5OfSkilledLarge: rows.filter((r) => r.skilledLarge - r.skilledSmall <= 5).length,
  };
}

/* ------------------------------------------------------------ 4. certificate tampering */

function tamperEval(n = 1000) {
  const base = { id: "cred-1", userName: "Test Learner", track: "summarization", issuedAt: "2026-10-24T00:00:00Z", expiresAt: "2028-10-24T00:00:00Z", score: 91, tasks: 2 };
  const { signature } = signPayload(base) as { signature: string };
  const genuineOk = verifyPayload(base, signature);
  let detected = 0;
  const keys = Object.keys(base) as (keyof typeof base)[];
  for (let i = 0; i < n; i++) {
    const p: Record<string, unknown> = { ...base };
    const k = keys[i % keys.length];
    p[k] = typeof p[k] === "number" ? (p[k] as number) + 1 + (i % 7) : `${p[k]}${String.fromCharCode(97 + (i % 26))}`;
    if (!verifyPayload(p, signature)) detected++;
  }
  // a signature from a different payload must not verify either
  const forged = signPayload({ ...base, score: 99 }) as { signature: string };
  return { mutations: n, detected, detectionRate: detected / n, genuineVerifies: genuineOk, crossSignatureRejected: !verifyPayload(base, forged.signature) };
}

/* ------------------------------------------------------------ 5. integrity signals */

function integrityEval() {
  // Synthetic sessions: [label, promptChars, elapsedMs, pastedChars, expectedFlag]
  const cases: [string, number, number, number, boolean][] = [];
  for (let cps = 2; cps <= 10; cps++) cases.push([`human ${cps} cps`, 600, (600 / cps) * 1000, 0, false]);
  for (let cps = 20; cps <= 100; cps += 10) cases.push([`bot ${cps} cps`, 600, (600 / cps) * 1000, 0, true]);
  for (const pasted of [300, 500, 590]) cases.push([`paste ${pasted}`, 600, 4000, pasted, false]); // pasting context is legitimate
  let correct = 0, tp = 0, fp = 0, fn = 0;
  for (const [, chars, ms, pasted, expect] of cases) {
    const got = integritySignals({ promptChars: chars, elapsedMs: ms, pastedChars: pasted, taskSuccess: 80 }).flags.includes("implausible_typing_speed");
    if (got === expect) correct++;
    if (got && expect) tp++; else if (got && !expect) fp++; else if (!got && expect) fn++;
  }
  return { sessions: cases.length, accuracy: round(correct / cases.length, 3), tp, fp, fn };
}

/* ------------------------------------------------------------ 6. latency */

async function latencyEval(iterations = 200) {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t = tasks[i % tasks.length];
    const c = await simulatedProvider.complete({ user: composeUserMessage(t.samplePrompt, t.context), maxTokens: t.tokenBudget, task: t, learnerPrompt: t.samplePrompt });
    const t0 = performance.now();
    scoreAttempt({ task: t, prompt: t.samplePrompt, response: c.text, promptTokens: c.inputTokens, outputTokens: c.outputTokens });
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const pct = (p: number) => round(times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))], 2);
  return { iterations, meanMs: round(mean(times), 2), p50Ms: pct(50), p95Ms: pct(95), maxMs: round(times[times.length - 1], 2) };
}

async function main() {
  const out = {
    generatedAt: new Date().toISOString(),
    techniques: techniqueEval(),
    separation: await separationEval(),
    localLab: await labEval(),
    tamper: tamperEval(),
    integrity: integrityEval(),
    latency: await latencyEval(),
  };
  const file = process.argv[2] ?? "eval-results.json";
  writeFileSync(file, JSON.stringify(out, null, 2));
  const { techniques: te, separation: se, localLab: lb, tamper: ta, integrity: ig, latency: la } = out;
  console.log("techniques micro", te.micro, "macroF1", te.macroF1, "exact", te.exactMatch);
  console.table(te.rows);
  console.table(se.tiers.map((t) => ({ tier: t.tier, success: t.success.mean, sdS: t.success.sd, eff: t.efficiency.mean, clarity: t.clarity.mean, tokens: t.tokens.mean })));
  console.log("ordered", se.orderedTasks, "expert>lazy", se.expertBeatsLazy, "passRate", se.passRate);
  console.table(se.rows.map((r) => ({ task: r.task, e: r.expert.success, a: r.average.success, l: r.lazy.success, eTok: r.expert.tokens, lTok: r.lazy.tokens })));
  console.table(lb.rows);
  console.log("lab", lb.smallMatchesOrBeatsLazyLarge, lb.smallWithin5OfSkilledLarge);
  console.log("tamper", ta, "integrity", ig, "latency", la);
  console.log("misses", te.misses);
}

main();
