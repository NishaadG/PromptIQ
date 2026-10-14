import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { listTasksForUser } from "@/lib/server/services/catalog";

export default async function Tasks() {
  const user = await requireUser();
  const tasks = await listTasksForUser(await getDb(), user.id);
  return (
    <div className="rise">
      <PageHeader eyebrow="Tasks" title={<>Real work, <span className="italic">graded.</span></>}>
        <span className="font-mono text-[0.75rem] text-ink-2">{tasks.filter((t) => t.status === "done").length} of {tasks.length} complete</span>
      </PageHeader>
      <ul className="px-5 py-6 md:px-10">
        {tasks.map((t) => (
          <li key={t.id} className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 border-b border-line py-6 md:grid-cols-[3rem_1fr_9rem_7rem_8rem]">
            <span className="font-display text-xl italic text-mute">{String(t.number).padStart(3, "0")}</span>
            <div>
              <div className="font-mono text-[0.65rem] uppercase tracking-wider text-mute">{t.category}</div>
              <Link href={`/dashboard/task/${t.id}`} className="font-display mt-1 block text-[1.3rem] leading-snug hover:text-rust">{t.title}</Link>
            </div>
            <span className="hidden font-mono text-[0.75rem] text-ink-2 md:block">{t.difficulty}</span>
            <span className="hidden font-mono text-[0.75rem] text-rust md:block">+{t.reward}</span>
            <div className="text-right">
              {t.status === "done" ? (
                <Link href={`/dashboard/task/${t.id}`} className="inline-flex items-center gap-1.5 font-mono text-[0.75rem] text-olive" title="Best score — retry to improve">
                  <Check size={13} /> {t.bestScore}
                </Link>
              ) : (
                <Link href={`/dashboard/task/${t.id}`} className="inline-flex items-center gap-1.5 text-sm hover:text-rust">
                  {t.status === "in-progress" ? `Resume · best ${t.bestScore}` : "Start"} <ArrowRight size={14} strokeWidth={1.5} />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
