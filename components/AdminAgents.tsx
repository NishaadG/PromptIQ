"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, X } from "lucide-react";
import type { AuthorProposal, IntegrityProposal } from "@/lib/server/agents";

type Flagged = {
  id: string; handle: string; taskTitle: string; taskSuccess: number; flags: string[]; detail: string;
  review: "exclude" | "clear" | null;
};
type Proposal = { id: string; createdAt: string } & ({ agent: "integrity_reviewer"; output: IntegrityProposal } | { agent: "task_author"; output: AuthorProposal });
type RunRow = { id: string; agent: string; status: string; policy: string; steps: number; tokensUsed: number; createdAt: string; error: string | null };

/** Integrity signals, the agents' proposals awaiting approval, and the agent run log. */
export function AdminAgents({ flagged, proposals, runs }: { flagged: Flagged[]; proposals: Proposal[]; runs: RunRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function call(key: string, url: string, body: unknown) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const pendingFor = new Set(proposals.flatMap((p) => (p.agent === "integrity_reviewer" ? [p.output.attemptId] : [])));

  return (
    <section className="px-5 pb-12 md:px-10">
      {msg && <p className="mb-4 border border-rust bg-rust-soft/40 px-4 py-3 text-[0.88rem] text-rust">{msg}</p>}

      <p className="eyebrow">Integrity signals</p>
      <p className="mt-2 max-w-2xl text-[0.85rem] text-ink-2">
        Behavioural signals for human review, not verdicts. The Integrity Reviewer agent gathers the evidence and proposes a decision;
        nothing changes until you approve it.
      </p>
      <ul className="mt-4 border-t border-ink">
        {flagged.length === 0 && <li className="border-b border-line py-3 text-[0.9rem] text-ink-2">No flagged attempts.</li>}
        {flagged.map((f) => (
          <li key={f.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-3 text-[0.9rem]">
            <span className="font-mono text-[0.75rem]">@{f.handle}</span>
            <span className="flex-1">{f.taskTitle} <span className="font-mono text-[0.75rem] text-mute">· score {f.taskSuccess}</span></span>
            <span className="font-mono text-[0.7rem] text-rust">{f.flags.join(", ").replaceAll("_", " ")}</span>
            <span className="font-mono text-[0.7rem] text-mute">{f.detail}</span>
            {f.review ? (
              <span className={`font-mono text-[0.7rem] ${f.review === "exclude" ? "text-rust" : "text-olive"}`}>{f.review === "exclude" ? "excluded" : "cleared"}</span>
            ) : pendingFor.has(f.id) ? (
              <span className="font-mono text-[0.7rem] text-mute">proposal pending</span>
            ) : (
              <button onClick={() => call(f.id, "/api/admin/agents", { agent: "integrity_reviewer", attemptId: f.id })} disabled={!!busy} className="flex items-center gap-1 text-[0.78rem] underline underline-offset-4 hover:text-rust disabled:opacity-40">
                <Bot size={13} strokeWidth={1.5} /> {busy === f.id ? "Reviewing…" : "Review with agent"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <p className="eyebrow mt-12">Awaiting approval</p>
      <ul className="mt-4 border-t border-ink">
        {proposals.length === 0 && <li className="border-b border-line py-3 text-[0.9rem] text-ink-2">No proposals waiting.</li>}
        {proposals.map((pr) => {
          const { id } = pr;
          const canApprove = pr.agent === "integrity_reviewer" || pr.output.passed;
          return (
            <li key={id} className="border-b border-line py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                {pr.agent === "integrity_reviewer" ? (
                  <span className="text-[0.92rem]">
                    Integrity Reviewer proposes to <span className={`font-medium ${pr.output.recommendation === "exclude" ? "text-rust" : "text-olive"}`}>{pr.output.recommendation}</span>
                    {" "}@{pr.output.handle}&rsquo;s attempt on {pr.output.taskTitle} <span className="font-mono text-[0.7rem] text-mute">· {pr.output.confidence} confidence</span>
                  </span>
                ) : (
                  <span className="text-[0.92rem]">
                    Task Author {pr.output.passed ? "proposes to publish" : "rejects its own draft of"} <span className="font-medium">{pr.output.title}</span>
                    <span className="font-mono text-[0.7rem] text-mute"> · {pr.output.taskId}{pr.output.existing ? " · updates an existing task" : ""}</span>
                  </span>
                )}
                <span className="flex gap-3">
                  <button onClick={() => call(id, `/api/admin/agents/${id}`, { approve: true })} disabled={!!busy || !canApprove} title={canApprove ? undefined : "Failed its checks"} className="flex items-center gap-1 text-[0.8rem] text-olive underline underline-offset-4 disabled:no-underline disabled:opacity-40"><Check size={13} /> Approve</button>
                  <button onClick={() => call(id, `/api/admin/agents/${id}`, { approve: false })} disabled={!!busy} className="flex items-center gap-1 text-[0.8rem] text-rust underline underline-offset-4 disabled:opacity-40"><X size={13} /> {canApprove ? "Reject" : "Dismiss"}</button>
                </span>
              </div>
              {pr.agent === "integrity_reviewer" ? (
                <>
                  <p className="mt-2 text-[0.88rem] text-ink-2">{pr.output.summary}</p>
                  <ul className="mt-2 space-y-0.5 font-mono text-[0.72rem] text-mute">{pr.output.evidence.map((e) => <li key={e}>· {e}</li>)}</ul>
                </>
              ) : (
                <>
                  {pr.output.levels.length > 0 && (
                    <p className="mt-2 font-mono text-[0.75rem] text-ink-2">
                      reference {pr.output.reference} · {pr.output.levels.map((l) => `${l.level} ${l.taskSuccess}`).join(" · ")}
                    </p>
                  )}
                  {pr.output.issues.length > 0 && <ul className="mt-2 space-y-0.5 text-[0.84rem] text-rust">{pr.output.issues.map((e) => <li key={e}>· {e}</li>)}</ul>}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="eyebrow mt-12">Agent runs</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[0.84rem]">
          <thead className="border-b border-ink font-mono text-[0.62rem] uppercase tracking-wider text-mute">
            <tr><th className="py-2">Agent</th><th>Status</th><th>Policy</th><th className="text-right">Steps</th><th className="text-right">Model tokens</th><th className="text-right">When</th></tr>
          </thead>
          <tbody>
            {runs.length === 0 && <tr><td colSpan={6} className="py-3 text-ink-2">No agent runs yet.</td></tr>}
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-line" title={r.error ?? undefined}>
                <td className="py-2.5">{r.agent.replaceAll("_", " ")}</td>
                <td className={`font-mono text-[0.75rem] ${r.status === "failed" || r.status === "rejected" ? "text-rust" : r.status === "awaiting_approval" ? "text-ink" : "text-olive"}`}>{r.status.replaceAll("_", " ")}</td>
                <td className="font-mono text-[0.75rem] text-mute">{r.policy}</td>
                <td className="text-right font-mono">{r.steps}</td>
                <td className="text-right font-mono">{r.tokensUsed}</td>
                <td className="text-right font-mono text-[0.72rem] text-mute">{new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
