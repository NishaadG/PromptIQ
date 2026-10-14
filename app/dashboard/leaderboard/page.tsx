import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { leaderboard } from "@/lib/server/services/catalog";

export default async function Leaderboard(props: PageProps<"/dashboard/leaderboard">) {
  const sp = await props.searchParams;
  const period = sp.period === "week" ? "week" : "all";
  const user = await requireUser();
  const rows = await leaderboard(await getDb(), { period, currentUserId: user.id, limit: 50 });
  const [first, second, third] = rows;
  const rest = rows.slice(3);
  const meIndex = rows.findIndex((r) => r.isYou);
  const above = meIndex > 0 ? rows[meIndex - 1] : null;

  return (
    <div className="rise">
      <PageHeader eyebrow="Leaderboard" title={<>The <span className="italic">standings.</span></>}>
        <div className="flex border border-line text-sm">
          {([["week", "This week"], ["all", "All time"]] as const).map(([key, label], i) => (
            <Link key={key} href={`/dashboard/leaderboard?period=${key}`} className={`px-4 py-2 ${period === key ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"} ${i > 0 ? "border-l border-line" : ""}`}>
              {label}
            </Link>
          ))}
        </div>
      </PageHeader>

      <section className="px-5 py-10 md:px-10">
        {rows.length === 0 ? (
          <p className="text-ink-2">No scored attempts this week yet — be the first.</p>
        ) : (
          <div className="grid border-y border-ink md:grid-cols-[1.4fr_1fr_1fr] md:divide-x md:divide-line">
            {[first, second, third].filter(Boolean).map((p, i) => (
              <div key={p.id} className={`px-2 py-8 md:px-8 ${i > 0 ? "border-t border-line md:border-t-0" : ""} ${p.isYou ? "bg-rust-soft/40" : ""}`}>
                <span className={`font-display italic leading-none ${i === 0 ? "text-[5rem] text-rust" : "text-[3.2rem] text-ink-2"}`}>{p.rank}</span>
                <div className={`font-display mt-5 leading-tight tracking-[-0.015em] ${i === 0 ? "text-[2rem]" : "text-[1.45rem]"}`}>{p.name}{p.isYou && <span className="ml-2 font-mono text-[0.62rem] uppercase tracking-wider text-rust">You</span>}</div>
                <div className="mt-1 text-[0.85rem] text-mute">{p.org}</div>
                <div className="mt-5 flex gap-6 font-mono text-[0.75rem] text-ink-2">
                  <span>L{p.level}</span>
                  <span className="tabular">{p.tokens.toLocaleString()} tk</span>
                  <span>eff {p.efficiency || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-12">
            <div className="grid grid-cols-[2.5rem_1fr_auto] gap-4 border-b border-ink pb-2 font-mono text-[0.65rem] uppercase tracking-wider text-mute sm:grid-cols-[3rem_1fr_4rem_4rem_7rem]">
              <span>#</span><span>Name</span>
              <span className="hidden text-right sm:block">Level</span>
              <span className="hidden text-right sm:block">Eff.</span>
              <span className="text-right">{period === "week" ? "Earned" : "Tokens"}</span>
            </div>
            {rest.map((p) => (
              <div key={p.id} className={`grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 border-b border-line py-4 sm:grid-cols-[3rem_1fr_4rem_4rem_7rem] ${p.isYou ? "relative bg-rust-soft/60" : ""}`}>
                {p.isYou && <span className="absolute inset-y-0 -left-5 w-[3px] bg-rust md:-left-10" />}
                <span className="font-display text-[1.4rem] italic leading-none text-ink-2">{p.rank}</span>
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className={`truncate text-[1rem] ${p.isYou ? "font-medium" : ""}`}>{p.name}</span>
                  {p.isYou && <span className="font-mono text-[0.62rem] uppercase tracking-wider text-rust">You</span>}
                  <span className="hidden truncate text-[0.8rem] text-mute lg:inline">{p.org}</span>
                  <span className="leader hidden sm:block" />
                </div>
                <span className="hidden text-right font-mono text-sm sm:block">L{p.level}</span>
                <span className="hidden text-right font-mono text-sm text-ink-2 sm:block">{p.efficiency || "—"}</span>
                <span className="text-right font-mono text-sm tabular">{p.tokens.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-6 font-mono text-[0.7rem] text-mute">
          {meIndex === -1
            ? period === "week" ? "Complete a task this week to appear here." : "You're outside the top 50 — every claimed task moves you up."
            : above ? `${(above.tokens - rows[meIndex].tokens + 1).toLocaleString()} tokens to overtake ${above.name}.` : "You're in first place."}
        </p>
      </section>
    </div>
  );
}
