import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { tasks } from "@/lib/mock-data";
import { PageHeader } from "@/components/PageHeader";

export default function Tasks() {
  return (
    <div className="rise">
      <PageHeader eyebrow="Tasks" title={<>Real work, <span className="italic">graded.</span></>}>
        <span className="font-mono text-[0.75rem] text-ink-2">{tasks.filter((t) => t.status === "done").length} of {tasks.length} complete</span>
      </PageHeader>
      <ul className="px-5 py-6 md:px-10">
        {tasks.map((t, i) => (
          <li key={t.id} className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 border-b border-line py-6 md:grid-cols-[3rem_1fr_9rem_7rem_8rem]">
            <span className="font-display text-xl italic text-mute">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="font-mono text-[0.65rem] uppercase tracking-wider text-mute">{t.category}</div>
              <div className="font-display mt-1 text-[1.3rem] leading-snug">{t.title}</div>
            </div>
            <span className="hidden font-mono text-[0.75rem] text-ink-2 md:block">{t.difficulty}</span>
            <span className="hidden font-mono text-[0.75rem] text-rust md:block">+{t.reward}</span>
            <div className="text-right">
              {t.status === "done" ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[0.75rem] text-olive"><Check size={13} /> {t.bestScore}</span>
              ) : (
                <Link href="/dashboard/task" className="inline-flex items-center gap-1.5 text-sm hover:text-rust">
                  {t.status === "in-progress" ? "Resume" : "Start"} <ArrowRight size={14} strokeWidth={1.5} />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
