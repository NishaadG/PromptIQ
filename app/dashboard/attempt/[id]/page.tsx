import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { getAttempt } from "@/lib/server/services/attempts";
import { eq } from "drizzle-orm";
import { tasks } from "@/lib/server/db/schema";

const FEEDBACK_TONE = { cost: "text-rust", warn: "text-rust", win: "text-olive", tip: "text-ink-2" } as const;

/** Read-only review of one of your past attempts: what you sent, what came back, and why it scored as it did. */
export default async function AttemptReview(props: PageProps<"/dashboard/attempt/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const db = await getDb();
  const a = await getAttempt(db, user.id, id);
  if (!a) notFound();
  const [task] = await db.select({ title: tasks.title, active: tasks.active }).from(tasks).where(eq(tasks.id, a.taskId)).limit(1); // retired tasks still reviewable
  return (
    <div className="rise">
      <PageHeader eyebrow={`Attempt ${a.attemptNumber} · ${a.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`} title={task?.title ?? a.taskId}>
        {task?.active && <Link href={`/dashboard/task/${a.taskId}`} className="btn btn-primary !py-2 !text-[0.85rem]">Try this task again</Link>}
      </PageHeader>
      <section className="grid gap-12 px-5 py-10 md:px-10 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Your prompt</p>
          <pre className="mt-3 whitespace-pre-wrap border border-line bg-card p-4 font-mono text-[0.82rem] leading-relaxed">{a.prompt}</pre>
          <p className="eyebrow mt-10">Model response <span className="normal-case tracking-normal text-mute">· {a.model}</span></p>
          <div className="mt-3 whitespace-pre-wrap border-l-2 border-ink pl-5 text-[0.95rem] leading-relaxed">{a.response}</div>
        </div>
        <div>
          <div className="grid grid-cols-4 border-y border-ink divide-x divide-line">
            {[["Success", a.taskSuccess], ["Efficiency", a.efficiency], ["Clarity", a.clarity], ["Tokens", a.totalTokens]].map(([k, v]) => (
              <div key={k} className="px-3 py-5">
                <div className="eyebrow">{k}</div>
                <div className="font-display mt-2 text-[2rem] leading-none tabular">{v}</div>
              </div>
            ))}
          </div>
          <p className="eyebrow mt-10">Rubric</p>
          <ul className="mt-2">
            {a.criteria.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 border-b border-line py-2 text-[0.88rem]">
                {c.passed ? <Check size={14} className="mt-0.5 shrink-0 text-olive" /> : <X size={14} className="mt-0.5 shrink-0 text-rust" />}
                <span>{c.label}{c.detail && !c.passed ? <span className="text-mute"> — {c.detail}</span> : null}</span>
              </li>
            ))}
          </ul>
          {a.techniques.length > 0 && (
            <>
              <p className="eyebrow mt-10">Techniques detected</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.techniques.map((t) => (
                  <span key={t.id} title={t.evidence} className="border border-line-2 bg-card px-2.5 py-1 font-mono text-[0.72rem] text-ink-2">{t.name}</span>
                ))}
              </div>
            </>
          )}
          <p className="eyebrow mt-10">Feedback</p>
          <ul className="mt-2">
            {a.feedback.map((f, i) => (
              <li key={i} className="border-b border-line py-3 text-[0.9rem]">
                <span className={`font-mono text-[0.65rem] uppercase tracking-wider ${FEEDBACK_TONE[f.kind]}`}>{f.kind}</span>
                <p className="mt-1 text-ink-2">{f.text}</p>
                {f.source && <p className="mt-1 font-mono text-[0.68rem] text-mute">{f.source}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-6 font-mono text-[0.7rem] text-mute">
            Reward {a.reward}{a.bonus ? ` + ${a.bonus} bonus` : ""} · {a.claimed ? "claimed" : "unclaimed"}
          </p>
        </div>
      </section>
    </div>
  );
}
