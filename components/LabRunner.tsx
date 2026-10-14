"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, HardDrive, Info, Play } from "lucide-react";
import type { LabSide } from "@/lib/server/db/schema";

type LabTask = { id: string; title: string; category: string; samplePrompt: string };
type History = { category: string; runs: number; cloud: number; local: number }[];
type Verdict = { kind: "matched" | "close" | "gap"; gap: number; text: string };

export function LabRunner({ tasks, history }: { tasks: LabTask[]; history: History }) {
  const router = useRouter();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const task = tasks.find((t) => t.id === taskId);
  const [prompt, setPrompt] = useState(task?.samplePrompt ?? "");
  const [result, setResult] = useState<{ cloud: LabSide; local: LabSide; verdict: Verdict } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/local-lab/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId, prompt }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      setResult({ cloud: data.run.cloud, local: data.run.local, verdict: data.verdict });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="px-5 py-10 md:px-10">
      <div className="grid gap-6 md:grid-cols-[10rem_1fr]">
        <label htmlFor="lab-task" className="eyebrow pt-2">Task</label>
        <select
          id="lab-task"
          value={taskId}
          onChange={(e) => { setTaskId(e.target.value); setPrompt(tasks.find((t) => t.id === e.target.value)?.samplePrompt ?? ""); setResult(null); }}
          className="font-display border-0 border-b border-line-2 bg-transparent py-2 text-[1.3rem] outline-none focus:border-ink"
        >
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.category}</option>)}
        </select>
        <label htmlFor="lab-prompt" className="eyebrow pt-1">Your prompt</label>
        <div className="border border-line bg-card">
          <textarea
            id="lab-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={7}
            maxLength={8000}
            className="block w-full resize-none bg-transparent px-5 py-4 font-mono text-[0.82rem] leading-relaxed text-ink-2 outline-none"
          />
          <div className="flex items-center justify-end border-t border-line px-4 py-2.5">
            <button onClick={run} disabled={busy || !prompt.trim()} className="btn btn-primary !py-2 !text-[0.85rem]">
              {busy ? "Running both…" : "Run on both"} <Play size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
      {error && <p className="mt-4 border border-rust bg-rust-soft/40 px-4 py-3 text-[0.88rem] text-rust">{error}</p>}

      {result && (
        <>
          <div className="rise mt-12 grid border border-ink bg-card md:grid-cols-2">
            <Side icon={<Cloud size={16} strokeWidth={1.5} />} d={result.cloud} />
            <Side icon={<HardDrive size={16} strokeWidth={1.5} />} d={result.local} highlight={result.verdict.kind === "matched"} />
          </div>
          <div className={`mt-6 flex items-start gap-3 border-l-2 px-5 py-4 ${result.verdict.kind === "matched" ? "border-olive bg-olive-soft/60" : result.verdict.kind === "gap" ? "border-rust bg-rust-soft/40" : "border-ink bg-paper-2"}`}>
            <Info size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <p className="text-[0.93rem] leading-relaxed text-ink">{result.verdict.text}</p>
          </div>
        </>
      )}

      <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="font-display text-[1.7rem] leading-tight tracking-[-0.015em]">Where small models hold up</h2>
          <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-2">
            Average task success across your Lab runs, by task type.{history.length === 0 && " Run a comparison to start building this picture."}
          </p>
        </div>
        <div>
          <div className="grid grid-cols-[1fr_4rem_4rem] border-b border-ink pb-2 font-mono text-[0.65rem] uppercase tracking-wider text-mute">
            <span>Task type</span><span className="text-right">Cloud</span><span className="text-right">Local</span>
          </div>
          {history.map((h) => {
            const gap = h.cloud - h.local;
            return (
              <div key={h.category} className="border-b border-line py-4">
                <div className="grid grid-cols-[1fr_4rem_4rem] items-baseline">
                  <span className="text-[0.95rem]">{h.category} <span className="font-mono text-[0.68rem] text-mute">· {h.runs} {h.runs === 1 ? "run" : "runs"}</span></span>
                  <span className="text-right font-mono text-sm tabular text-ink-2">{h.cloud}</span>
                  <span className={`text-right font-mono text-sm tabular ${gap <= 4 ? "text-olive" : gap > 20 ? "text-rust" : ""}`}>{h.local}</span>
                </div>
                <div className="relative mt-3 h-[3px] bg-line">
                  <div className="bar absolute inset-y-0 left-0 bg-line-2" style={{ width: `${h.cloud}%` }} />
                  <div className={`bar absolute inset-y-0 left-0 ${gap <= 4 ? "bg-olive" : gap > 20 ? "bg-rust" : "bg-ink"}`} style={{ width: `${h.local}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Side({ icon, d, highlight }: { icon: React.ReactNode; d: LabSide; highlight?: boolean }) {
  const isLocal = d.costUsd === 0;
  return (
    <div className={`flex flex-col ${isLocal ? "border-t border-ink md:border-t-0 md:border-l" : ""}`}>
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className={isLocal ? "text-olive" : "text-ink-2"}>{icon}</span>
          <div>
            <div className="text-[0.95rem] font-medium">{d.label}</div>
            <div className="font-mono text-[0.68rem] text-mute">{d.model} · {d.totalTokens} tokens</div>
          </div>
        </div>
        {highlight && <span className="border border-olive px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-olive">Matched</span>}
      </div>
      <pre className="max-h-80 flex-1 overflow-auto whitespace-pre-wrap bg-paper px-6 py-5 font-mono text-[0.8rem] leading-relaxed text-ink">{d.response}</pre>
      <dl className="grid grid-cols-3 divide-x divide-line border-t border-line">
        <Stat k="Quality" v={`${d.taskSuccess}`} />
        <Stat k="Cost" v={d.costUsd === 0 ? "$0.00" : d.costUsd < 0.01 ? `$${d.costUsd.toFixed(4)}` : `$${d.costUsd.toFixed(2)}`} accent={isLocal ? "text-olive" : undefined} />
        <Stat k="Latency" v={`${(d.latencyMs / 1000).toFixed(1)}s`} />
      </dl>
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="px-6 py-4">
      <dt className="eyebrow !text-[0.6rem]">{k}</dt>
      <dd className={`font-display mt-1 text-[1.7rem] leading-none tabular ${accent ?? ""}`}>{v}</dd>
    </div>
  );
}
