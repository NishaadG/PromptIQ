"use client";

import { useState } from "react";
import { ArrowRight, GraduationCap, Wand2 } from "lucide-react";
import type { OptimiserResult, TutorHint } from "@/lib/server/agents";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "The agent could not finish");
  return data as T;
}

/** AI Tutor and Prompt Optimiser for one attempt. */
export function AgentCoach({ attemptId }: { attemptId: string }) {
  const [hints, setHints] = useState<TutorHint[]>([]);
  const [opt, setOpt] = useState<OptimiserResult | null>(null);
  const [busy, setBusy] = useState<"tutor" | "optimiser" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = hints[hints.length - 1];

  async function ask(kind: "tutor" | "optimiser") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "tutor") {
        const { hint } = await post<{ hint: TutorHint }>("/api/agents/tutor", { attemptId });
        setHints((h) => [...h, hint]);
      } else {
        setOpt((await post<{ result: OptimiserResult }>("/api/agents/optimiser", { attemptId })).result);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-10">
      <p className="eyebrow">Agents</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button onClick={() => ask("tutor")} disabled={!!busy || last?.lastLevel} className="btn !py-2 !text-[0.85rem]">
          <GraduationCap size={15} strokeWidth={1.5} />
          {busy === "tutor" ? "Thinking…" : hints.length === 0 ? "Ask the tutor" : last?.lastLevel ? "No more hints" : "Another hint"}
        </button>
        <button onClick={() => ask("optimiser")} disabled={!!busy || !!opt} className="btn !py-2 !text-[0.85rem]">
          <Wand2 size={15} strokeWidth={1.5} /> {busy === "optimiser" ? "Rewriting and re-running…" : "Optimise my prompt"}
        </button>
      </div>
      {error && <p className="mt-3 text-[0.85rem] text-rust">{error}</p>}

      {hints.length > 0 && (
        <ol className="mt-5 border-t border-line">
          {hints.map((h, i) => (
            <li key={i} className="rise border-b border-line py-4">
              <div className="font-mono text-[0.62rem] uppercase tracking-wider text-mute">Hint {h.level} of 3 · {h.focus === "efficiency" ? "efficiency" : "missed criterion"}</div>
              <p className="mt-1.5 text-[0.93rem] leading-relaxed text-ink">{h.question}</p>
              {h.technique && <p className="mt-2 text-[0.88rem] text-ink-2"><span className="font-medium text-ink">Try: {h.technique.name}.</span> {h.explanation}</p>}
              {h.pattern && <pre className="mt-2 whitespace-pre-wrap border border-line bg-card px-3 py-2 font-mono text-[0.76rem] text-ink-2">{h.pattern}</pre>}
              {h.habit && <p className="mt-2 text-[0.82rem] text-olive">{h.habit}</p>}
            </li>
          ))}
        </ol>
      )}

      {opt && (
        <div className="rise mt-6 border border-ink bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-3">
            <span className="eyebrow !text-ink">Prompt Optimiser</span>
            <span className="font-mono text-[0.72rem] text-ink-2">
              success {opt.original.taskSuccess} <ArrowRight size={11} className="inline" /> <span className={opt.improved ? "text-olive" : ""}>{opt.optimised.taskSuccess}</span>
              {" · "}PES {opt.original.pes} <ArrowRight size={11} className="inline" /> {opt.optimised.pes}
            </span>
          </div>
          {opt.improved ? (
            <>
              <ul className="px-5 pt-4 text-[0.88rem]">
                {opt.changes.map((c) => <li key={c.what} className="py-1"><span className="font-medium">{c.what}.</span> <span className="text-ink-2">{c.why}</span></li>)}
              </ul>
              <pre className="mx-5 my-4 max-h-64 overflow-auto whitespace-pre-wrap border-l-2 border-olive bg-paper px-4 py-3 font-mono text-[0.78rem] leading-relaxed">{opt.optimised.prompt}</pre>
              <p className="px-5 pb-4 text-[0.75rem] text-mute">Practice only: this run isn&rsquo;t an attempt and earns nothing. Try writing your own version before you reuse it.</p>
            </>
          ) : (
            <p className="px-5 py-4 text-[0.9rem] text-ink-2">Three rewrites didn&rsquo;t beat your prompt on this model. {opt.notes[opt.notes.length - 1]}</p>
          )}
        </div>
      )}
    </div>
  );
}
