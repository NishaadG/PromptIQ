/**
 * LLM providers. All free options:
 *  - "simulated" (default): offline, deterministic, reacts to prompt quality. No key, no network.
 *  - "openai":   any OpenAI-compatible /chat/completions endpoint, e.g.
 *                 Ollama (local, free):   LLM_BASE_URL=http://localhost:11434/v1  LLM_MODEL=qwen2.5:1.5b
 *                 Groq free tier:         LLM_BASE_URL=https://api.groq.com/openai/v1  LLM_API_KEY=...
 *                 Gemini free tier:       LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai  LLM_API_KEY=...
 * Configure with LLM_PROVIDER=openai plus the variables above.
 */
import type { Task } from "./db/schema";
import { countTokens } from "../scoring/tokens";
import { detectTechniques, has } from "../scoring/techniques";

export type Completion = { text: string; model: string; provider: string; inputTokens: number; outputTokens: number; latencyMs: number };
export interface LlmProvider {
  name: string;
  complete(input: { system?: string; user: string; maxTokens: number; task?: Task; learnerPrompt?: string }): Promise<Completion>;
}

/* ----------------------------------------------------------------------------- simulated */

/**
 * Starts from the task's reference ("ideal") response and degrades it in the ways real models do
 * when a prompt under-specifies the job. Deterministic, so scores are reproducible in demos/tests.
 */
export function simulateResponse(task: Task, prompt: string): string {
  const ts = detectTechniques(prompt);
  const words = prompt.trim().split(/\s+/).length;
  let paras = task.simulatedResponse.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let joiner = "\n\n";
  // A single bullet list counts as several parts (one per bullet).
  if (paras.length === 1 && /(^|\n)\s*([-*•]|\d+[.)])\s+/.test(paras[0]) && paras[0].includes("\n")) {
    paras = paras[0].split("\n").map((l) => l.trim()).filter(Boolean);
    joiner = "\n";
  }

  // Vague prompts get vague, partial answers.
  if (words < 12) paras = paras.slice(0, 1);
  else if (words < 25 && !has(ts, "numbered_asks")) paras = paras.slice(0, Math.max(1, paras.length - 1));

  // Extraction without a requested format comes back as prose, not JSON.
  if ((task.domain === "extraction" || task.domain === "classification") && !has(ts, "structured")) {
    paras = paras.map((p) => p.replace(/```(?:json)?\s*([\s\S]*?)```/g, (_m, body: string) => {
      try {
        return Object.entries(JSON.parse(body) as Record<string, unknown>).map(([k, v]) => `The ${k.replace(/_/g, " ")} is ${v}.`).join(" ");
      } catch { return body; }
    }));
  }

  // Answer-only on a reasoning task: the model skips its working and often gets it wrong.
  if (has(ts, "answer_only") && ["reasoning", "code", "explanation"].includes(task.domain)) {
    paras = [paras[paras.length - 1].replace(/\d+(\.\d+)?/, (n) => String(Number(n) + 1))];
  }

  let text = paras.join(joiner);
  // No audience or length guidance -> padded, generic preamble and recap.
  if (!has(ts, "length_limit") && !has(ts, "audience")) {
    text = `Certainly! Here is a detailed overview of the material you provided, covering the key points and their implications.\n\n${text}\n\nIn summary, the points above capture the main considerations. Let me know if you would like any further detail or clarification on any part of this.`;
  }
  return text;
}

export const simulatedProvider: LlmProvider = {
  name: "simulated",
  async complete({ system, user, task, learnerPrompt }) {
    const t0 = Date.now();
    // Judge prompt quality from what the learner wrote, not from the pasted source text.
    const text = task ? simulateResponse(task, `${system ?? ""}\n${learnerPrompt ?? user}`) : "Simulated response.";
    return {
      text, model: "promptiq-sim-1", provider: "simulated",
      inputTokens: countTokens(`${system ?? ""}${user}`), outputTokens: countTokens(text),
      latencyMs: Date.now() - t0 + 600 + (text.length % 700),
    };
  },
};

/* ----------------------------------------------------------------------------- OpenAI-compatible */

export function openAiCompatible(opts: { baseUrl: string; apiKey?: string; model: string; name?: string }): LlmProvider {
  return {
    name: opts.name ?? "openai",
    async complete({ system, user, maxTokens }) {
      const t0 = Date.now();
      const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}) },
        body: JSON.stringify({
          model: opts.model,
          messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`LLM provider error ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as {
        model?: string; choices: { message: { content: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      return {
        text, model: data.model ?? opts.model, provider: opts.name ?? "openai",
        inputTokens: data.usage?.prompt_tokens ?? countTokens(`${system ?? ""}${user}`),
        outputTokens: data.usage?.completion_tokens ?? countTokens(text),
        latencyMs: Date.now() - t0,
      };
    },
  };
}

/* ----------------------------------------------------------------------------- selection */

export function getProvider(kind = process.env.LLM_PROVIDER ?? "simulated"): LlmProvider {
  if (kind === "openai" && process.env.LLM_BASE_URL && process.env.LLM_MODEL) {
    return openAiCompatible({ baseUrl: process.env.LLM_BASE_URL, apiKey: process.env.LLM_API_KEY, model: process.env.LLM_MODEL });
  }
  return simulatedProvider;
}

/** Second provider for Local Lab comparisons (e.g. a small local Ollama model). */
export function getLocalProvider(): LlmProvider {
  if (process.env.LOCAL_LLM_BASE_URL && process.env.LOCAL_LLM_MODEL) {
    return openAiCompatible({ baseUrl: process.env.LOCAL_LLM_BASE_URL, model: process.env.LOCAL_LLM_MODEL, name: "local" });
  }
  return simulatedProvider;
}

/** Build the message the model sees: {{context}} in the prompt is replaced by the source text; otherwise it is appended. */
export function composeUserMessage(prompt: string, context: string) {
  if (!context.trim()) return prompt;
  if (prompt.includes("{{context}}")) return prompt.replaceAll("{{context}}", context);
  return `${prompt.trim()}\n\n---\n${context}`;
}
