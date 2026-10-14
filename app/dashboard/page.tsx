import Link from "next/link";
import { ArrowRight, Clock, Flame, Coins } from "lucide-react";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { getDashboard } from "@/lib/server/services/present";
import { listTasksForUser } from "@/lib/server/services/catalog";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

export default async function Dashboard() {
  const user = await requireUser();
  const db = await getDb();
  const [d, tasks] = await Promise.all([getDashboard(db, user), listTasksForUser(db, user.id)]);
  const { progress: p, stats, recent, next } = d;
  const pct = Math.round((p.xpIntoLevel / p.xpForLevel) * 100);
  const weekEarned = stats.week.reduce((s, w) => s + w.earned, 0);
  const maxWeek = Math.max(1, ...stats.week.map((w) => w.earned));
  const today = new Date().toISOString().slice(0, 10);
  const upNext = tasks.filter((t) => t.status !== "done" && t.id !== next?.id).slice(0, 5);
  const summaryDone = tasks.filter((t) => t.category === "Summarization" && (t.bestScore ?? 0) >= 85).length;
  const summaryTotal = tasks.filter((t) => t.category === "Summarization").length;

  return (
    <div className="rise">
      <section className="border-b border-line px-5 pt-10 pb-8 md:px-10">
        <p className="eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display mt-3 text-[2.4rem] leading-[1.02] tracking-[-0.025em] md:text-[3rem]">
          {greeting()}, <span className="italic">{user.name.split(" ")[0]}.</span>
        </h1>

        <div className="mt-10 grid grid-cols-1 border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
          <div className="py-5 sm:pr-8">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Level</span>
              <span className="text-[0.75rem] text-mute">{p.title}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-display text-[3rem] leading-none">{p.level}</span>
              <span className="font-mono text-[0.75rem] text-mute tabular">{p.xp.toLocaleString()} / {p.xpToNext.toLocaleString()} xp</span>
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
              <span className="font-display text-[3rem] leading-none tabular">{p.tokens.toLocaleString()}</span>
              <span className="font-mono text-[0.75rem] text-olive">+{weekEarned.toLocaleString()} this wk</span>
            </div>
            <div className="mt-4 flex h-6 items-end gap-1" aria-label="Tokens earned, last 7 days">
              {stats.week.map((w) => (
                <div key={w.day} className="flex flex-1 flex-col items-center gap-1" title={`${w.day}: +${w.earned}`}>
                  <div className={`w-full ${w.day === today ? "bg-rust" : "bg-line-2"}`} style={{ height: `${Math.max(2, (w.earned / maxWeek) * 20)}px` }} />
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
              <span className="font-display text-[3rem] leading-none">{p.streak}</span>
              <span className="text-[0.85rem] text-ink-2">{p.streak === 1 ? "day" : "days"}</span>
            </div>
            <div className="mt-4 flex gap-1">
              {stats.week.map((w) => {
                const active = w.earned > 0;
                const isToday = w.day === today;
                return (
                  <div key={w.day} className={`flex h-6 flex-1 items-center justify-center font-mono text-[0.6rem] ${active ? "bg-ink text-paper" : isToday ? "border border-dashed border-rust text-rust" : "border border-line text-mute"}`}>
                    {DAY_LETTERS[new Date(`${w.day}T12:00:00Z`).getUTCDay()]}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-12 gap-x-8 px-5 py-10 md:px-10">
        <div className="col-span-12 xl:col-span-8">
          {next && (
            <div className="relative border border-ink bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
                <span className="eyebrow !text-rust">Recommended for your level</span>
                <div className="flex items-center gap-4 font-mono text-[0.72rem] text-ink-2">
                  <span>{next.category}</span>
                  <span className="text-line-2">/</span>
                  <span>{next.difficulty}</span>
                  <span className="text-line-2">/</span>
                  <span className="flex items-center gap-1"><Clock size={12} strokeWidth={1.5} /> ~{next.estMinutes} min</span>
                </div>
              </div>
              <div className="grid gap-8 px-6 py-8 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <h2 className="font-display text-[2rem] leading-[1.08] tracking-[-0.02em] md:text-[2.4rem]">{next.title}</h2>
                  <p className="mt-4 max-w-[36rem] leading-relaxed text-ink-2 line-clamp-3">{next.brief}</p>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <span className="font-mono text-[0.75rem] text-ink-2">Reward <span className="text-rust">+{next.reward}</span></span>
                  <Link href={`/dashboard/task/${next.id}`} className="btn btn-primary">
                    {next.status === "in-progress" ? "Resume task" : "Start task"} <ArrowRight size={15} strokeWidth={1.75} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="mt-12">
            <div className="flex items-baseline justify-between border-b border-line pb-3">
              <h3 className="font-display text-xl">Up next</h3>
              <Link href="/dashboard/tasks" className="text-sm text-mute hover:text-ink">All tasks →</Link>
            </div>
            <ul>
              {upNext.length === 0 && <li className="border-b border-line py-4 text-[0.92rem] text-ink-2">You&rsquo;ve completed every task. New ones are added regularly.</li>}
              {upNext.map((t) => (
                <li key={t.id} className="border-b border-line">
                  <Link href={`/dashboard/task/${t.id}`} className="group flex items-baseline gap-4 py-4">
                    <span className="w-28 shrink-0 font-mono text-[0.7rem] uppercase tracking-wider text-mute">{t.category}</span>
                    <span className="flex-1 text-[0.95rem] group-hover:text-rust">{t.title}</span>
                    <span className="hidden font-mono text-[0.75rem] text-ink-2 sm:inline">{t.difficulty}</span>
                    <span className="w-12 text-right font-mono text-[0.75rem] text-rust">+{t.reward}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="col-span-12 mt-12 xl:col-span-4 xl:mt-0">
          <div className="border-b border-line pb-3">
            <h3 className="font-display text-xl">Recent scores</h3>
          </div>
          <ul>
            {recent.length === 0 && <li className="border-b border-line py-4 text-[0.92rem] text-ink-2">No attempts yet — your first score appears here.</li>}
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-4 border-b border-line py-4">
                <span className={`font-display w-10 text-[1.6rem] leading-none ${a.taskSuccess >= 90 ? "text-olive" : a.taskSuccess < 80 ? "text-rust" : ""}`}>{a.taskSuccess}</span>
                <div className="flex-1">
                  <div className="text-[0.92rem]">{a.title}</div>
                  <div className="font-mono text-[0.7rem] text-mute">{a.totalTokens} tokens · {ago(a.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 bg-paper-2 p-5">
            <p className="eyebrow">Certification</p>
            <p className="mt-3 text-[0.92rem] leading-snug text-ink-2">
              {summaryDone >= summaryTotal
                ? <>All <span className="text-ink">Summarization</span> tasks passed at 85+. Claim your certificate on your profile.</>
                : <>{summaryTotal - summaryDone} more <span className="text-ink">Summarization</span> {summaryTotal - summaryDone === 1 ? "task" : "tasks"} above 85 unlocks your certificate.</>}
            </p>
            <div className="mt-4 flex gap-1.5">
              {Array.from({ length: summaryTotal }, (_, i) => (
                <span key={i} className={`h-2 flex-1 ${i < summaryDone ? "bg-olive" : "border border-line-2"}`} />
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
