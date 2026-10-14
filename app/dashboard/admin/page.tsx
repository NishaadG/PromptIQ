import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { AdminItemBank } from "@/components/AdminItemBank";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { isAdmin, itemStats, MIN_ATTEMPTS_TO_RECALIBRATE } from "@/lib/server/services/admin";

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const items = await itemStats(await getDb());
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
    </div>
  );
}
