import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { AdminItemBank } from "@/components/AdminItemBank";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { flaggedAttempts, isAdmin, itemStats, MIN_ATTEMPTS_TO_RECALIBRATE } from "@/lib/server/services/admin";

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const db = await getDb();
  const [items, flagged] = await Promise.all([itemStats(db), flaggedAttempts(db)]);
  return (
    <div className="rise">
      <PageHeader eyebrow="Admin · Item bank" title={<>The <span className="italic">questions.</span></>}>
        <p className="max-w-sm text-[0.88rem] leading-relaxed text-ink-2">
          Statistics exclude demo accounts. Recalibrate a task&rsquo;s benchmark medians once it has {MIN_ATTEMPTS_TO_RECALIBRATE}+ real attempts.
        </p>
      </PageHeader>
      <AdminItemBank
        items={items.map((s) => ({
          id: s.task.id, number: s.task.number, title: s.task.title, category: s.task.category, active: s.task.active,
          difficultyRating: Math.round(s.task.difficultyRating), medianScore: s.task.medianScore, medianTokens: s.task.medianTokens,
          attempts: s.attempts, learners: s.learners, meanScore: s.meanScore, passRate: s.passRate,
          observedMedianScore: s.observedMedianScore, observedMedianTokens: s.observedMedianTokens,
        }))}
        minAttempts={MIN_ATTEMPTS_TO_RECALIBRATE}
      />
      <section className="px-5 pb-12 md:px-10">
        <p className="eyebrow">Integrity signals</p>
        <p className="mt-2 max-w-2xl text-[0.85rem] text-ink-2">
          Behavioural signals for human review, not verdicts. Attempts typed faster than humanly plausible are excluded from
          certification evidence; other flags are informational only.
        </p>
        <ul className="mt-4 border-t border-ink">
          {flagged.length === 0 && <li className="border-b border-line py-3 text-[0.9rem] text-ink-2">No flagged attempts.</li>}
          {flagged.map((f) => (
            <li key={f.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-3 text-[0.9rem]">
              <span className="font-mono text-[0.75rem]">@{f.handle}</span>
              <span className="flex-1">{f.taskTitle} <span className="font-mono text-[0.75rem] text-mute">· score {f.taskSuccess}</span></span>
              <span className="font-mono text-[0.7rem] text-rust">{f.integrity.flags.join(", ").replaceAll("_", " ")}</span>
              <span className="font-mono text-[0.7rem] text-mute">
                {Number(f.promptChars)} chars
                {f.integrity.elapsedMs !== undefined && ` in ${(f.integrity.elapsedMs / 1000).toFixed(1)}s`}
                {f.integrity.pastedChars ? ` · ${f.integrity.pastedChars} pasted` : ""} · {f.createdAt.toLocaleDateString("en-GB")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
