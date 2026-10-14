"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CornerDownLeft, Lightbulb, RotateCcw, Sparkles, TrendingDown, TriangleAlert, X } from "lucide-react";
import type { ClientTask } from "@/lib/server/services/catalog";
import type { ClientAttempt } from "@/lib/server/services/present";

type Phase = "idle" | "running" | "revealing" | "done";
const estimateTokens = (s: string) => Math.ceil(s.trim().length / 4);

export function TaskRunner({ task, balance, priorAttempts }: { task: ClientTask; balance: number; priorAttempts: number }) {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState<ClientAttempt | null>(null);
  const [percentile, setPercentile] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [attemptNo, setAttemptNo] = useState(priorAttempts + 1);

  const paragraphs = attempt ? attempt.response.split(/\n\s*\n/).filter((p) => p.trim()) : [];
  const usesContext = prompt.includes("{{context}}");
  const est = estimateTokens(prompt) + (usesContext ? estimateTokens(task.context) - 3 : estimateTokens(task.context));

  async function submit() {
    const text = prompt.trim() || task.samplePrompt;
    if (!prompt.trim()) setPrompt(text);
    setError(null);
    setPhase("running");
    setShown(0);
    try {
      const res = await fetch(`/api/tasks/${task.id}/attempts`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setAttempt(data.attempt);
      setPercentile(data.percentile);
      setAttemptNo(data.attempt.attemptNumber);
      setPhase("revealing");
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  useEffect(() => {
    if (phase !== "revealing") return;
    const timers = paragraphs.map((_, i) => setTimeout(() => setShown(i + 1), 350 + i * 450));
    timers.push(setTimeout(() => setPhase("done"), 350 + paragraphs.length * 450 + 300));
    return () => timers.forEach(clearTimeout);
  }, [phase, paragraphs.length]);

  function reset() {
    setPhase("idle");
    setShown(0);
    setAttempt(null);
    setAttemptNo((n) => n + 1);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-10">
        <div className="flex items-center gap-5">
          <Link href="/dashboard/tasks" className="flex items-center gap-2 text-sm text-mute hover:text-ink">
            <ArrowLeft size={15} strokeWidth={1.5} /> Tasks
          </Link>
          <span className="h-4 w-px bg-line-2" />
          <span className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-2">Task {String(task.number).padStart(3, "0")} · {task.category}</span>
        </div>
        <div className="flex items-center gap-5 font-mono text-[0.72rem] text-ink-2">
          <span>Budget <span className="text-ink">{task.tokenBudget}</span> tokens</span>
          <span>Reward <span className="text-rust">+{task.reward}</span></span>
        </div>
      </div>

      <div className="grid flex-1 lg:grid-cols-2">
        <section className="border-b border-line px-5 py-10 md:px-10 lg:border-r lg:border-b-0">
          <p className="eyebrow">The brief</p>
          <h1 className="font-display mt-3 text-[2rem] leading-[1.08] tracking-[-0.02em] md:text-[2.3rem]">{task.title}</h1>
          <p className="mt-5 leading-relaxed text-ink-2">{task.brief}</p>

          <figure className="mt-8 border border-line bg-card">
            <figcaption className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <span className="font-mono text-[0.7rem] text-ink-2">{task.contextLabel}</span>
              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-mute">Source · ~{estimateTokens(task.context)} tokens</span>
            </figcaption>
            <blockquote className="font-display max-h-72 overflow-auto whitespace-pre-wrap px-5 py-5 text-[0.98rem] leading-[1.65] text-ink-2">{task.context}</blockquote>
          </figure>

          <div className="mt-10">
            <div className="flex items-baseline justify-between">
              <label htmlFor="prompt" className="eyebrow !text-ink">Your prompt</label>
              <span className={`font-mono text-[0.72rem] tabular ${est > task.tokenBudget ? "text-rust" : "text-mute"}`}>
                ~{est} / {task.tokenBudget} tokens incl. source
              </span>
            </div>
            <div className={`mt-3 border bg-card transition-colors ${phase === "idle" ? "border-ink" : "border-line"}`}>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && phase === "idle") submit(); }}
                disabled={phase !== "idle"}
                rows={10}
                maxLength={8000}
                placeholder="Write the prompt you'd actually send…"
                className="block w-full resize-none bg-transparent px-5 py-4 font-mono text-[0.85rem] leading-relaxed outline-none placeholder:text-[#B8AD9C] disabled:text-ink-2"
              />
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                {phase === "idle" ? (
                  <button type="button" onClick={() => setPrompt(task.samplePrompt)} className="text-[0.8rem] text-mute underline decoration-line-2 underline-offset-4 hover:text-ink">
                    Use a sample prompt
                  </button>
                ) : (
                  <button type="button" onClick={reset} disabled={phase !== "done"} className="flex items-center gap-1.5 text-[0.8rem] text-mute hover:text-ink disabled:opacity-40">
                    <RotateCcw size={13} strokeWidth={1.5} /> Try again
                  </button>
                )}
                <button onClick={submit} disabled={phase !== "idle"} className="btn btn-primary !py-2 !text-[0.85rem]">
                  {phase === "running" ? "Running…" : "Submit"} <CornerDownLeft size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            <p className="mt-3 font-mono text-[0.68rem] leading-relaxed text-mute">
              Ctrl + Enter to submit · Attempt {attemptNo} · The source text is appended to your prompt automatically — or place it yourself with <span className="text-ink-2">{"{{context}}"}</span>.
            </p>
            {error && <p className="mt-4 border border-rust bg-rust-soft/40 px-4 py-3 text-[0.88rem] text-rust">{error}</p>}
          </div>
        </section>

        <section className="bg-paper-2/60 px-5 py-10 md:px-10">
          {phase === "idle" || !attempt ? (
            phase === "running" ? <p className="font-mono text-[0.8rem] text-mute">Running your prompt…<span className="caret ml-2 inline-block h-4 w-2 bg-ink align-middle" /></p> : <EmptyState task={task} />
          ) : (
            <div>
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Model response</p>
                <span className="font-mono text-[0.68rem] text-mute">
                  {phase === "revealing" ? "generating…" : `${attempt.provider === "simulated" ? "simulated model" : attempt.model} · ${(attempt.latencyMs / 1000).toFixed(1)}s`}
                </span>
              </div>
              <div className="mt-4 space-y-4 border-l-2 border-ink pl-5">
                {paragraphs.slice(0, shown).map((p, i) => (
                  <p key={i} className="rise whitespace-pre-wrap text-[0.98rem] leading-relaxed" dangerouslySetInnerHTML={{ __html: md(p) }} />
                ))}
                {phase === "revealing" && <span className="caret inline-block h-4 w-2 bg-ink align-middle" />}
              </div>
              {phase === "done" && <ScoreCard a={attempt} task={task} percentile={percentile} balance={balance} />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ task }: { task: ClientTask }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col justify-between">
      <div>
        <p className="eyebrow">What gets scored</p>
        <ul className="mt-6">
          {[
            ["Task success", "Did the output meet the rubric? Accuracy, audience fit, the ask."],
            ["Tokens used", "Prompt + source + output. Counted with a real tokenizer."],
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
        <p className="eyebrow mt-8">The rubric</p>
        <ul className="mt-3 space-y-1.5 text-[0.88rem] text-ink-2">
          {task.criteria.map((c) => <li key={c}>· {c}</li>)}
        </ul>
      </div>
      <p className="font-display mt-10 max-w-sm text-[1.4rem] leading-snug text-ink-2">
        Median score on this task is <span className="text-ink">{task.medianScore}</span>. Median spend, <span className="text-ink">{task.medianTokens} tokens</span>.
      </p>
    </div>
  );
}

function ScoreCard({ a, task, percentile, balance }: { a: ClientAttempt; task: ClientTask; percentile: number; balance: number }) {
  const router = useRouter();
  const [claim, setClaim] = useState<{ earned: number; balance: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const total = a.reward + a.bonus;

  async function doClaim() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/attempts/${a.id}/claim`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not claim");
      setClaim({ earned: data.earned, balance: data.user.tokens });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12">
      <div className="rise relative border border-ink bg-card">
        <div className="absolute -top-3 left-5 bg-card px-2 eyebrow !text-ink">Score</div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-6 border-b border-line px-6 pt-8 pb-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[5.5rem] leading-[0.8] tracking-[-0.04em]">{a.taskSuccess}</span>
              <span className="font-display text-3xl text-mute">%</span>
            </div>
            <div className="eyebrow mt-3">Task success · {percentile >= 50 ? `top ${Math.max(1, 100 - percentile)}%` : `beats ${percentile}% of attempts`}</div>
          </div>
          <div className="stamp flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-rust text-rust" style={{ animationDelay: "350ms" }}>
            <span className="font-display text-2xl leading-none">+{total}</span>
            <span className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.2em]">tokens</span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          <Metric label="Tokens used" value={`${a.totalTokens}`} sub={`of ${task.tokenBudget} budget`} bar={Math.min(1, a.totalTokens / task.tokenBudget)} />
          <Metric label="Efficiency" value={`${a.efficiency}`} sub={`median spend ${task.medianTokens}`} bar={a.efficiency / 100} tone="olive" />
          <Metric label="Clarity" value={`${a.clarity}`} sub="reader-fit" bar={a.clarity / 100} />
        </div>
        <ul className="px-6 py-4">
          {a.criteria.map((c) => (
            <li key={c.label} className="flex items-start gap-2.5 py-1.5 text-[0.86rem]">
              {c.passed ? <Check size={14} className="mt-0.5 shrink-0 text-olive" /> : <X size={14} className="mt-0.5 shrink-0 text-rust" />}
              <span className={c.passed ? "text-ink-2" : "text-ink"}>{c.label}{c.detail && !c.passed ? <span className="text-mute"> — {c.detail}</span> : null}</span>
            </li>
          ))}
        </ul>
      </div>

      {a.techniques.length > 0 && (
        <div className="rise mt-8" style={{ animationDelay: "120ms" }}>
          <p className="eyebrow">Techniques we detected</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.techniques.map((t) => (
              <span key={t.id} title={t.evidence} className="border border-line-2 bg-card px-2.5 py-1 font-mono text-[0.72rem] text-ink-2">{t.name}</span>
            ))}
          </div>
        </div>
      )}

      <div className="rise mt-10" style={{ animationDelay: "200ms" }}>
        <p className="eyebrow">Feedback</p>
        <ul className="mt-4">
          {a.feedback.map((f, i) => {
            const Icon = f.kind === "cost" ? TrendingDown : f.kind === "win" ? Sparkles : f.kind === "warn" ? TriangleAlert : Lightbulb;
            const color = f.kind === "cost" || f.kind === "warn" ? "text-rust" : f.kind === "win" ? "text-olive" : "text-ink-2";
            return (
              <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-2 border-t border-line py-4 last:border-b">
                <Icon size={15} strokeWidth={1.5} className={`mt-0.5 ${color}`} />
                <p className="text-[0.93rem] leading-relaxed text-ink-2">
                  {f.text}
                  {f.source && <span className="ml-1 font-mono text-[0.65rem] uppercase tracking-wider text-mute">· {f.source}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rise mt-10 flex flex-wrap items-center justify-between gap-4 bg-ink px-6 py-5 text-paper" style={{ animationDelay: "350ms" }}>
        <div>
          <div className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[#A99C8A]">
            {claim ? (claim.earned > 0 ? "Added to balance" : "No improvement on your best for this task") : `${a.reward} base + ${a.bonus} efficiency bonus`}
          </div>
          <div className="font-display mt-1 text-2xl tabular">
            {claim ? `${claim.balance.toLocaleString()} tokens` : `+${total} tokens earned`}
          </div>
          {err && <div className="mt-1 text-[0.8rem] text-[#F0B9A6]">{err}</div>}
        </div>
        {claim ? (
          <Link href="/dashboard/leaderboard" className="btn border-paper text-paper hover:bg-[#2E2924]">
            See leaderboard <ArrowRight size={15} strokeWidth={1.75} />
          </Link>
        ) : (
          <button onClick={doClaim} disabled={busy} className="btn btn-rust !shadow-[3px_3px_0_#FBF8F2]">
            {busy ? "Claiming…" : "Claim reward"} <ArrowRight size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <p className="mt-3 font-mono text-[0.65rem] text-mute">Balance before this claim: {balance.toLocaleString()} · you earn your best result per task once.</p>
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

// Tiny, escaped markdown: **bold**, *italic*, `code`
function md(s: string) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```(?:json|python)?\n?([\s\S]*?)```/g, '<code class="block font-mono text-[0.82rem]">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="font-mono text-[0.85em]">$1</code>');
}
