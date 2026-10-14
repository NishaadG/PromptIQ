"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string; number: number; title: string; category: string; active: boolean; difficultyRating: number;
  medianScore: number; medianTokens: number; attempts: number; learners: number; meanScore: number | null;
  passRate: number | null; observedMedianScore: number | null; observedMedianTokens: number | null;
};

const TEMPLATE = {
  id: "new-task-slug", title: "Task title", category: "Summarization", domain: "summarization", difficulty: "Intermediate",
  estMinutes: 5, reward: 100, brief: "What the learner must get the model to do, for whom, and why.",
  contextLabel: "Source document", context: "The source text the model will work on.", tokenBudget: 600,
  rubric: [
    { kind: "includes_any", label: "Mentions the key point", terms: ["key phrase"], weight: 3 },
    { kind: "max_words", label: "Concise (≤100 words)", max: 100, weight: 1 },
  ],
  simulatedResponse: "A reference answer that satisfies every rubric criterion.",
  samplePrompt: "A strong example prompt. Use {{context}} to place the source text.",
  medianScore: 70, medianTokens: 500, active: true,
};

export function AdminItemBank({ items, minAttempts }: { items: Item[]; minAttempts: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [json, setJson] = useState(JSON.stringify(TEMPLATE, null, 2));

  async function call(url: string, method: string, body?: unknown) {
    setMsg(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const issues = Array.isArray(data.details) ? data.details.map((d: { path: unknown[]; message: string }) => `${d.path.join(".")}: ${d.message}`).join("; ") : "";
      setMsg(`${data.error ?? "Request failed"}${issues ? ` — ${issues}` : ""}`);
      return false;
    }
    router.refresh();
    return true;
  }

  async function save() {
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { return setMsg("The task definition is not valid JSON"); }
    if (await call("/api/admin/tasks", "POST", parsed)) setMsg("Saved.");
  }

  return (
    <section className="px-5 py-8 md:px-10">
      {msg && <p className="mb-6 border border-line-2 bg-card px-4 py-3 text-[0.88rem]">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[0.86rem]">
          <thead className="border-b border-ink font-mono text-[0.62rem] uppercase tracking-wider text-mute">
            <tr>
              <th className="py-2">#</th><th>Task</th><th className="text-right">Attempts</th><th className="text-right">Mean</th>
              <th className="text-right">Pass %</th><th className="text-right">Median (bench → obs.)</th><th className="text-right">Tokens (bench → obs.)</th>
              <th className="text-right">Difficulty</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={`border-b border-line ${i.active ? "" : "opacity-50"}`}>
                <td className="py-3 font-mono text-mute">{String(i.number).padStart(3, "0")}</td>
                <td><div>{i.title}</div><div className="font-mono text-[0.65rem] text-mute">{i.category} · {i.id}</div></td>
                <td className="text-right font-mono">{i.attempts} <span className="text-mute">({i.learners})</span></td>
                <td className="text-right font-mono">{i.meanScore ?? "—"}</td>
                <td className="text-right font-mono">{i.passRate ?? "—"}</td>
                <td className="text-right font-mono">{i.medianScore} → {i.observedMedianScore ?? "—"}</td>
                <td className="text-right font-mono">{i.medianTokens} → {i.observedMedianTokens ?? "—"}</td>
                <td className="text-right font-mono">{i.difficultyRating}</td>
                <td className="space-x-3 text-right whitespace-nowrap">
                  <button className="text-[0.78rem] underline underline-offset-4 hover:text-rust" onClick={() => call(`/api/admin/tasks/${i.id}`, "PATCH", { active: !i.active })}>
                    {i.active ? "Retire" : "Activate"}
                  </button>
                  <button disabled={i.attempts < minAttempts} title={i.attempts < minAttempts ? `Needs ${minAttempts} attempts` : ""} className="text-[0.78rem] underline underline-offset-4 hover:text-rust disabled:no-underline disabled:opacity-40" onClick={() => call(`/api/admin/tasks/${i.id}/recalibrate`, "POST")}>
                    Recalibrate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-14">
        <p className="eyebrow">Create or update a task</p>
        <p className="mt-2 max-w-2xl text-[0.88rem] text-ink-2">
          Saving with an existing <span className="font-mono">id</span> updates that task. Rubric criterion kinds:
          <span className="font-mono"> includes_any, includes_all, excludes, max_words, min_items, json_fields, regex, llm_judge</span>.
          The simulated response must pass the rubric — it is what the offline model returns for a strong prompt.
        </p>
        <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={22} spellCheck={false}
          className="mt-4 block w-full border border-line bg-card px-5 py-4 font-mono text-[0.78rem] leading-relaxed outline-none focus:border-ink" />
        <button onClick={save} className="btn btn-primary mt-4">Save task</button>
      </div>
    </section>
  );
}
