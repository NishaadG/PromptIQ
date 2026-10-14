import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { listUserAttempts } from "@/lib/server/services/attempts";
import { dashboardStats, listTasksForUser } from "@/lib/server/services/catalog";
import { progressOf } from "@/lib/server/services/present";
import { listCredentials, trackProgress } from "@/lib/server/services/certification";
import { Certificates } from "@/components/Certificates";

export default async function Profile() {
  const user = await requireUser();
  const db = await getDb();
  const [stats, history, tasks, tracks, held] = await Promise.all([
    dashboardStats(db, user.id), listUserAttempts(db, user.id, 15), listTasksForUser(db, user.id),
    trackProgress(db, user.id), listCredentials(db, user.id),
  ]);
  const p = progressOf(user);
  return (
    <div className="rise">
      <PageHeader eyebrow={`Profile · @${user.handle}`} title={user.name} />
      <section className="grid gap-12 px-5 py-10 md:px-10 lg:grid-cols-[1fr_1.4fr]">
        <dl className="border-t border-ink">
          {[
            ["Level", `${p.level} — ${p.title}`],
            ["Token balance", p.tokens.toLocaleString()],
            ["Current streak", `${p.streak} ${p.streak === 1 ? "day" : "days"} (best ${p.longestStreak})`],
            ["Skill rating", String(p.rating)],
            ["Average task success", stats.attempts ? String(stats.avgSuccess) : "—"],
            ["Average efficiency", stats.attempts ? String(stats.avgEfficiency) : "—"],
            ["Tasks completed", `${tasks.filter((t) => t.status === "done").length} of ${tasks.length}`],
            ["LLM tokens spent", stats.llmTokensSpent.toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-3 border-b border-line py-4">
              <dt className="text-ink-2">{k}</dt>
              <span className="leader" />
              <dd className="font-mono text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <Certificates tracks={tracks} held={held.map((c) => ({ id: c.id, track: c.track, level: c.level, score: c.score, expiresAt: c.expiresAt.toISOString(), revoked: c.revoked }))} />
          <p className="eyebrow mt-12">History</p>
          <ul className="mt-2">
            {history.length === 0 && <li className="border-b border-line py-3 text-[0.92rem] text-ink-2">No attempts yet.</li>}
            {history.map((a) => (
              <li key={a.id} className="flex items-baseline gap-4 border-b border-line py-3 text-[0.92rem]">
                <span className="font-display w-8 text-lg">{a.taskSuccess}</span>
                <span className="flex-1">{a.title}</span>
                <span className="font-mono text-[0.7rem] text-mute">{a.totalTokens} tk · {a.claimed ? "claimed" : "unclaimed"} · {a.createdAt.toLocaleDateString("en-GB")}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
