import Link from "next/link";
import { ArrowRight, Clock, Flame, Coins } from "lucide-react";
import { currentUser, featuredTask, recentActivity, weekTokens, tasks } from "@/lib/mock-data";

const days = ["M", "T", "W", "T", "F", "S", "S"];

export default function Dashboard() {
  const pct = Math.round((currentUser.xp / currentUser.xpToNext) * 100);
  const maxWeek = Math.max(...weekTokens);

  return (
    <div className="rise">
      {/* Greeting + stat rail */}
      <section className="border-b border-line px-5 pt-10 pb-8 md:px-10">
        <p className="eyebrow">Saturday, 26 September</p>
        <h1 className="font-display mt-3 text-[2.4rem] leading-[1.02] tracking-[-0.025em] md:text-[3rem]">
          Good morning, <span className="italic">{currentUser.name.split(" ")[0]}.</span>
        </h1>

        <div className="mt-10 grid grid-cols-1 border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
          <div className="py-5 sm:pr-8">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Level</span>
              <span className="text-[0.75rem] text-mute">{currentUser.levelTitle}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-display text-[3rem] leading-none">{currentUser.level}</span>
              <span className="font-mono text-[0.75rem] text-mute tabular">{currentUser.xp.toLocaleString()} / {currentUser.xpToNext.toLocaleString()} xp</span>
            </div>
            <div className="mt-4 h-[3px] w-full bg-line">
              <div className="bar h-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="border-t border-line py-5 sm:border-t-0 sm:px-8">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Token balance</span>
              <Coins size={14} strokeWidth={1.5} className="text-mute" />
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-display text-[3rem] leading-none tabular">{currentUser.tokens.toLocaleString()}</span>
              <span className="font-mono text-[0.75rem] text-olive">+1,330 this wk</span>
            </div>
            <div className="mt-4 flex h-6 items-end gap-1">
              {weekTokens.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className={`w-full ${i === 5 ? "bg-rust" : "bg-line-2"}`} style={{ height: `${Math.max(2, (v / maxWeek) * 20)}px` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-line py-5 sm:border-t-0 sm:pl-8">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Streak</span>
              <Flame size={14} strokeWidth={1.5} className="text-rust" />
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-display text-[3rem] leading-none">{currentUser.streak}</span>
              <span className="text-[0.85rem] text-ink-2">days</span>
            </div>
            <div className="mt-4 flex gap-1">
              {days.map((d, i) => (
                <div key={i} className={`flex h-6 flex-1 items-center justify-center font-mono text-[0.6rem] ${i < 5 ? "bg-ink text-paper" : i === 5 ? "border border-dashed border-rust text-rust" : "border border-line text-mute"}`}>
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured task */}
      <section className="grid grid-cols-12 gap-x-8 px-5 py-10 md:px-10">
        <div className="col-span-12 xl:col-span-8">
          <div className="relative border border-ink bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
              <span className="eyebrow !text-rust">Today&rsquo;s task</span>
              <div className="flex items-center gap-4 font-mono text-[0.72rem] text-ink-2">
                <span>{featuredTask.category}</span>
                <span className="text-line-2">/</span>
                <span>{featuredTask.difficulty}</span>
                <span className="text-line-2">/</span>
                <span className="flex items-center gap-1"><Clock size={12} strokeWidth={1.5} /> ~{featuredTask.estMinutes} min</span>
              </div>
            </div>
            <div className="grid gap-8 px-6 py-8 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className="font-display text-[2rem] leading-[1.08] tracking-[-0.02em] md:text-[2.4rem]">
                  Summarize this legal clause for a <span className="italic">non-lawyer.</span>
                </h2>
                <p className="mt-4 max-w-[36rem] leading-relaxed text-ink-2">
                  An indemnification clause from a supplier contract. Explain what the owner is agreeing to,
                  and the one thing they should push back on — in under {featuredTask.tokenBudget} tokens.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 md:items-end">
                <span className="font-mono text-[0.75rem] text-ink-2">Reward <span className="text-rust">+{featuredTask.reward}</span></span>
                <Link href="/dashboard/task" className="btn btn-primary">
                  Start task <ArrowRight size={15} strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          </div>

          {/* Up next */}
          <div className="mt-12">
            <div className="flex items-baseline justify-between border-b border-line pb-3">
              <h3 className="font-display text-xl">Up next</h3>
              <Link href="/dashboard/tasks" className="text-sm text-mute hover:text-ink">All tasks →</Link>
            </div>
            <ul>
              {tasks.filter((t) => t.status !== "done" && t.id !== featuredTask.id).map((t) => (
                <li key={t.id} className="group flex items-baseline gap-4 border-b border-line py-4">
                  <span className="w-28 shrink-0 font-mono text-[0.7rem] uppercase tracking-wider text-mute">{t.category}</span>
                  <span className="flex-1 text-[0.95rem] group-hover:text-rust">{t.title}</span>
                  <span className="hidden font-mono text-[0.75rem] text-ink-2 sm:inline">{t.difficulty}</span>
                  <span className="w-12 text-right font-mono text-[0.75rem] text-rust">+{t.reward}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recent */}
        <aside className="col-span-12 mt-12 xl:col-span-4 xl:mt-0">
          <div className="border-b border-line pb-3">
            <h3 className="font-display text-xl">Recent scores</h3>
          </div>
          <ul>
            {recentActivity.map((a) => (
              <li key={a.label} className="flex items-center gap-4 border-b border-line py-4">
                <span className={`font-display w-10 text-[1.6rem] leading-none ${a.score >= 90 ? "text-olive" : a.score < 80 ? "text-rust" : ""}`}>{a.score}</span>
                <div className="flex-1">
                  <div className="text-[0.92rem]">{a.label}</div>
                  <div className="font-mono text-[0.7rem] text-mute">{a.tokens} tokens · {a.when}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 bg-paper-2 p-5">
            <p className="eyebrow">Certification</p>
            <p className="mt-3 text-[0.92rem] leading-snug text-ink-2">
              Two more <span className="text-ink">Summarization</span> tasks above 85 unlocks your Level&nbsp;II certificate.
            </p>
            <div className="mt-4 flex gap-1.5">
              {[1, 1, 1, 0, 0].map((v, i) => (
                <span key={i} className={`h-2 flex-1 ${v ? "bg-olive" : "border border-line-2"}`} />
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
