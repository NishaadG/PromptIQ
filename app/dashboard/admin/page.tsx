import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { AdminItemBank } from "@/components/AdminItemBank";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { flaggedAttempts, isAdmin, itemStats, MIN_ATTEMPTS_TO_RECALIBRATE } from "@/lib/server/services/admin";
import { AdminAgents } from "@/components/AdminAgents";
import { listRuns, type IntegrityProposal } from "@/lib/server/agents";

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const db = await getDb();
  const [items, flagged, pending, runs] = await Promise.all([
    itemStats(db), flaggedAttempts(db), listRuns(db, { status: "awaiting_approval" }), listRuns(db, { limit: 25 }),
  ]);
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
      <AdminAgents
        flagged={flagged.map((f) => ({
          id: f.id, handle: f.handle, taskTitle: f.taskTitle, taskSuccess: f.taskSuccess, flags: f.integrity.flags,
          review: f.integrity.review?.decision ?? null,
          detail: `${Number(f.promptChars)} chars${f.integrity.elapsedMs !== undefined ? ` in ${(f.integrity.elapsedMs / 1000).toFixed(1)}s` : ""}${f.integrity.pastedChars ? ` · ${f.integrity.pastedChars} pasted` : ""} · ${f.createdAt.toLocaleDateString("en-GB")}`,
        }))}
        proposals={pending.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), output: r.output as IntegrityProposal }))}
        runs={runs.map((r) => ({
          id: r.id, agent: r.agent, status: r.status, policy: r.policy, steps: r.steps.length, tokensUsed: r.tokensUsed,
          createdAt: r.createdAt.toISOString(), error: r.error,
        }))}
      />
    </div>
  );
}
