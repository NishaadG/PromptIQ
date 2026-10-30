"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import type { Plan } from "@/lib/server/agents";

/** Curriculum Planner: the learner's next three tasks, each with the reason it was picked. */
export function PlanPanel() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/planner", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build a plan");
      setPlan(data.plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h3 className="font-display text-xl">Your learning plan</h3>
        <button onClick={load} disabled={busy} className="flex items-center gap-1.5 text-sm text-mute hover:text-ink disabled:opacity-50">
          <Compass size={14} strokeWidth={1.5} /> {busy ? "Planning…" : plan ? "Re-plan" : "Plan my next three tasks"}
        </button>
      </div>
      {error && <p className="py-3 text-[0.88rem] text-rust">{error}</p>}
      {!plan && !error && (
        <p className="py-4 text-[0.9rem] text-ink-2">The Curriculum Planner picks tasks you have a fair chance of passing, weighted towards the techniques you rarely use.</p>
      )}
      {plan && (
        <>
          {plan.focus && <p className="pt-4 text-[0.88rem] text-ink-2">Focus this week: <span className="text-ink">{plan.focus.name}</span>.</p>}
          <ol>
            {plan.items.map((i, n) => (
              <li key={i.taskId} className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-3 border-b border-line py-4">
                <span className="font-display text-lg italic text-mute">{n + 1}</span>
                <div>
                  <Link href={`/dashboard/task/${i.taskId}`} className="text-[0.95rem] hover:text-rust">{i.title}</Link>
                  <p className="mt-1 text-[0.82rem] text-ink-2">{i.reason}</p>
                </div>
                <span className="font-mono text-[0.72rem] text-mute">{i.category}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
