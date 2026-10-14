import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { teamOverview } from "@/lib/server/services/team";
import { CLOUD_USD_PER_MTOK } from "@/lib/server/services/lab";

export default async function TeamPage() {
  const user = await requireUser();
  const team = user.org ? await teamOverview(await getDb(), user.org) : null;
  if (!team) {
    return (
      <div className="rise">
        <PageHeader eyebrow="Team" title={<>Your <span className="italic">team.</span></>} />
        <section className="px-5 py-10 md:px-10">
          <p className="max-w-xl text-ink-2">
            Add your organisation on your <Link href="/dashboard/profile" className="underline underline-offset-4 hover:text-ink">profile</Link> to see
            colleagues who use the same organisation name, and your team&rsquo;s AI-readiness.
          </p>
        </section>
      </div>
    );
  }
  const s = team.summary;
  const savedUsd = (s.tokensSaved * CLOUD_USD_PER_MTOK) / 1e6;
  return (
    <div className="rise">
      <PageHeader eyebrow="Team · AI readiness" title={<>{team.org}</>}>
        <span className="font-mono text-[0.75rem] text-ink-2">{s.members} {s.members === 1 ? "member" : "members"} · {s.activeMembers} active</span>
      </PageHeader>
      <section className="px-5 py-10 md:px-10">
        <div className="grid border-y border-ink sm:grid-cols-4 sm:divide-x sm:divide-line">
          {[
            ["Certified", `${s.certifiedShare}%`, "members holding a current certificate"],
            ["Task success", s.avgSuccess ?? "—", "average across active members"],
            ["Efficiency", s.avgEfficiency ?? "—", "success per token vs. median"],
            ["Tokens saved", s.tokensSaved.toLocaleString(), `vs. task medians ≈ $${savedUsd.toFixed(savedUsd < 1 ? 4 : 2)} at $${CLOUD_USD_PER_MTOK}/M`],
          ].map(([k, v, sub]) => (
            <div key={k as string} className="border-b border-line px-1 py-6 sm:border-b-0 sm:px-6">
              <div className="eyebrow">{k}</div>
              <div className="font-display mt-3 text-[2.6rem] leading-none tabular">{v}</div>
              <div className="mt-2 text-[0.75rem] text-mute">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[0.9rem]">
            <thead className="border-b border-ink font-mono text-[0.62rem] uppercase tracking-wider text-mute">
              <tr><th className="py-2">Member</th><th className="text-right">Level</th><th className="text-right">Tasks done</th><th className="text-right">Success</th><th className="text-right">Efficiency</th><th className="text-right">Certificates</th></tr>
            </thead>
            <tbody>
              {team.members.map((m) => (
                <tr key={m.id} className={`border-b border-line ${m.id === user.id ? "bg-rust-soft/50" : ""}`}>
                  <td className="py-3">{m.name} <span className="font-mono text-[0.7rem] text-mute">@{m.handle}</span></td>
                  <td className="text-right font-mono">L{m.level}</td>
                  <td className="text-right font-mono">{m.tasksCompleted}</td>
                  <td className="text-right font-mono">{m.avgSuccess ?? "—"}</td>
                  <td className="text-right font-mono">{m.avgEfficiency ?? "—"}</td>
                  <td className="text-right font-mono">{m.certificates}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 font-mono text-[0.7rem] text-mute">Team membership is based on the organisation name on each profile.</p>
      </section>
    </div>
  );
}
