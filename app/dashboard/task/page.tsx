"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CornerDownLeft, RotateCcw, TrendingDown, Sparkles, Lightbulb } from "lucide-react";
import { featuredTask as task, mockResult as r, currentUser } from "@/lib/mock-data";

type Phase = "idle" | "running" | "done";

const SAMPLE =
  "You're helping a small-business owner who isn't a lawyer and will read this on their phone.\n\nExplain the clause below in plain English, in three short bullets:\n1. What they're agreeing to\n2. The catch\n3. The one thing to push back on (quote the exact phrase)\n\nKeep each bullet under 40 words.\n\nClause: [§9.3 ¶3]";

const estimateTokens = (s: string) => Math.ceil(s.trim().length / 4);

export default function TaskPage() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState(0); // response paragraphs revealed

  const est = estimateTokens(prompt);

  function submit() {
    if (!prompt.trim()) setPrompt(SAMPLE);
    setPhase("running");
    setShown(0);
  }

  useEffect(() => {
    if (phase !== "running") return;
    const timers = r.response.map((_, i) => setTimeout(() => setShown(i + 1), 700 + i * 650));
    timers.push(setTimeout(() => setPhase("done"), 700 + r.response.length * 650 + 200));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  function reset() {
    setPhase("idle");
    setShown(0);
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Task bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-10">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-mute hover:text-ink">
            <ArrowLeft size={15} strokeWidth={1.5} /> Dashboard
          </Link>
          <span className="h-4 w-px bg-line-2" />
          <span className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-2">Task 041 · {task.category}</span>
        </div>
        <div className="flex items-center gap-5 font-mono text-[0.72rem] text-ink-2">
          <span>Budget <span className="text-ink">{task.tokenBudget}</span> tokens</span>
          <span>Reward <span className="text-rust">+{task.reward}</span></span>
        </div>
      </div>

      <div className="grid flex-1 lg:grid-cols-2">
        {/* LEFT — brief + prompt */}
        <section className="border-b border-line px-5 py-10 md:px-10 lg:border-r lg:border-b-0">
          <p className="eyebrow">The brief</p>
          <h1 className="font-display mt-3 text-[2rem] leading-[1.08] tracking-[-0.02em] md:text-[2.3rem]">
            Summarize this legal clause for a <span className="italic">non-lawyer.</span>
          </h1>
          <p className="mt-5 leading-relaxed text-ink-2">{task.brief}</p>

          <figure className="mt-8 border border-line bg-card">
            <figcaption className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <span className="font-mono text-[0.7rem] text-ink-2">{task.contextLabel}</span>
              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-mute">Source doc · 4 pages</span>
            </figcaption>
            <blockquote className="font-display px-5 py-5 text-[0.98rem] leading-[1.65] text-ink-2">
              {task.context}
            </blockquote>
          </figure>

          <div className="mt-10">
            <div className="flex items-baseline justify-between">
              <label htmlFor="prompt" className="eyebrow !text-ink">Your prompt</label>
              <span className={`font-mono text-[0.72rem] tabular ${est > task.tokenBudget ? "text-rust" : "text-mute"}`}>
                ~{est} / {task.tokenBudget} tokens
              </span>
            </div>
            <div className={`mt-3 border bg-card transition-colors ${phase === "idle" ? "border-ink" : "border-line"}`}>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
                disabled={phase !== "idle"}
                rows={10}
                placeholder="Write the prompt you'd actually send…"
                className="block w-full resize-none bg-transparent px-5 py-4 font-mono text-[0.85rem] leading-relaxed outline-none placeholder:text-[#B8AD9C] disabled:text-ink-2"
              />
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                {phase === "idle" ? (
                  <button type="button" onClick={() => setPrompt(SAMPLE)} className="text-[0.8rem] text-mute underline decoration-line-2 underline-offset-4 hover:text-ink">
                    Use a sample prompt
                  </button>
                ) : (
                  <button type="button" onClick={reset} className="flex items-center gap-1.5 text-[0.8rem] text-mute hover:text-ink">
                    <RotateCcw size={13} strokeWidth={1.5} /> Try again
                  </button>
                )}
                <button onClick={submit} disabled={phase !== "idle"} className="btn btn-primary !py-2 !text-[0.85rem]">
                  Submit <CornerDownLeft size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            <p className="mt-3 font-mono text-[0.68rem] text-mute">Ctrl + Enter to submit · Attempt 1 of 3</p>
          </div>
        </section>

        {/* RIGHT — output + score */}
        <section className="bg-paper-2/60 px-5 py-10 md:px-10">
          {phase === "idle" ? (
            <EmptyState />
          ) : (
            <div>
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Model response</p>
                <span className="font-mono text-[0.68rem] text-mute">{phase === "running" ? "generating…" : "cloud model · 1.4s"}</span>
              </div>
              <div className="mt-4 space-y-4 border-l-2 border-ink pl-5">
                {r.response.slice(0, shown).map((p, i) => (
                  <p key={i} className="rise text-[0.98rem] leading-relaxed" dangerouslySetInnerHTML={{ __html: md(p) }} />
                ))}
                {phase === "running" && <span className="caret inline-block h-4 w-2 bg-ink align-middle" />}
              </div>

              {phase === "running" && shown === r.response.length && (
                <p className="mt-10 font-mono text-[0.75rem] text-mute">Scoring against rubric…</p>
              )}

              {phase === "done" && <ScoreCard />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[420px] flex-col justify-between">
      <div>
        <p className="eyebrow">What gets scored</p>
        <ul className="mt-6 space-y-0">
          {[
            ["Task success", "Did the output meet the rubric? Accuracy, audience fit, the ask."],
            ["Tokens used", "Prompt + context + output. Measured, not estimated."],
            ["Efficiency", "Success per token, against the median solver."],
          ].map(([h, b], i) => (
            <li key={h} className="grid grid-cols-[2.5rem_1fr] border-t border-line py-5 last:border-b">
              <span className="font-display text-xl italic text-mute">{i + 1}</span>
              <div>
                <div className="font-medium">{h}</div>
                <div className="mt-1 text-[0.9rem] text-ink-2">{b}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="font-display mt-10 max-w-sm text-[1.4rem] leading-snug text-ink-2">
        Median score on this task is <span className="text-ink">74</span>. Median spend, <span className="text-ink">610 tokens</span>.
      </p>
    </div>
  );
}

function ScoreCard() {
  const [claimed, setClaimed] = useState(false);
  const saved = r.baselineTokens - r.tokensUsed;

  return (
    <div className="mt-12">
      {/* Headline score */}
      <div className="rise relative border border-ink bg-card">
        <div className="absolute -top-3 left-5 bg-card px-2 eyebrow !text-ink">Score</div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-6 border-b border-line px-6 pt-8 pb-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[5.5rem] leading-[0.8] tracking-[-0.04em]">{r.taskSuccess}</span>
              <span className="font-display text-3xl text-mute">%</span>
            </div>
            <div className="eyebrow mt-3">Task success · top 12%</div>
          </div>
          <div className="relative">
            <div className="stamp flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-rust text-rust" style={{ animationDelay: "350ms" }}>
              <span className="font-display text-2xl leading-none">+{r.reward + r.bonus}</span>
              <span className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.2em]">tokens</span>
            </div>
            <span className="floatup pointer-events-none absolute -top-2 right-0 font-mono text-sm text-rust" style={{ animationDelay: "700ms" }}>+{r.reward + r.bonus}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          <Metric label="Tokens used" value={`${r.tokensUsed}`} sub={`of ${r.tokenBudget} budget`} bar={r.tokensUsed / r.tokenBudget} />
          <Metric label="Efficiency" value={`${r.efficiency}`} sub="median 63" bar={r.efficiency / 100} tone="olive" />
          <Metric label="Clarity" value={`${r.clarity}`} sub="reader-fit" bar={r.clarity / 100} />
        </div>

        <div className="flex items-center gap-3 px-6 py-3 font-mono text-[0.72rem] text-ink-2">
          <TrendingDown size={14} strokeWidth={1.5} className="text-olive" />
          {saved} tokens saved vs. your first attempt ({r.baselineTokens})
        </div>
      </div>

      {/* Feedback */}
      <div className="rise mt-10" style={{ animationDelay: "200ms" }}>
        <p className="eyebrow">Feedback</p>
        <ul className="mt-4">
          {r.feedback.map((f, i) => {
            const Icon = f.kind === "cost" ? TrendingDown : f.kind === "win" ? Sparkles : Lightbulb;
            const color = f.kind === "cost" ? "text-rust" : f.kind === "win" ? "text-olive" : "text-ink-2";
            return (
              <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-2 border-t border-line py-4 last:border-b">
                <Icon size={15} strokeWidth={1.5} className={`mt-0.5 ${color}`} />
                <p className="text-[0.93rem] leading-relaxed text-ink-2">{f.text}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Reward */}
      <div className="rise mt-10 flex flex-wrap items-center justify-between gap-4 bg-ink px-6 py-5 text-paper" style={{ animationDelay: "350ms" }}>
        <div>
          <div className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[#A99C8A]">
            {claimed ? "Added to balance" : `${r.reward} base + ${r.bonus} efficiency bonus`}
          </div>
          <div className="font-display mt-1 text-2xl tabular">
            {claimed ? `${(currentUser.tokens + r.reward + r.bonus).toLocaleString()} tokens` : `+${r.reward + r.bonus} tokens earned`}
          </div>
        </div>
        {claimed ? (
          <Link href="/dashboard/leaderboard" className="btn border-paper text-paper hover:bg-[#2E2924]">
            See leaderboard <ArrowRight size={15} strokeWidth={1.75} />
          </Link>
        ) : (
          <button onClick={() => setClaimed(true)} className="btn btn-rust !shadow-[3px_3px_0_#FBF8F2]">
            Claim reward <ArrowRight size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, sub, bar, tone }: { label: string; value: string; sub: string; bar: number; tone?: "olive" }) {
  return (
    <div className="px-5 py-5">
      <div className="eyebrow !text-[0.6rem]">{label}</div>
      <div className="mt-2 font-mono text-[1.6rem] leading-none tabular">{value}</div>
      <div className="mt-3 h-[3px] bg-line">
        <div className={`bar h-full ${tone === "olive" ? "bg-olive" : "bg-ink"}`} style={{ width: `${bar * 100}%` }} />
      </div>
      <div className="mt-2 text-[0.72rem] text-mute">{sub}</div>
    </div>
  );
}

// Tiny markdown: **bold**, *italic*
function md(s: string) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}
