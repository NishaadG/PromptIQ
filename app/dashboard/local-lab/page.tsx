import { PageHeader } from "@/components/PageHeader";
import { LabRunner } from "@/components/LabRunner";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { listTasksForUser } from "@/lib/server/services/catalog";
import { labHistory } from "@/lib/server/services/lab";

export default async function LocalLab() {
  const user = await requireUser();
  const db = await getDb();
  const [tasks, history] = await Promise.all([listTasksForUser(db, user.id), labHistory(db, user.id)]);
  return (
    <div className="rise">
      <PageHeader eyebrow="Local Lab" title={<>Same prompt. <span className="italic">Smaller</span> model.</>}>
        <p className="max-w-sm text-[0.92rem] leading-relaxed text-ink-2">
          Good prompts travel. Run a prompt on a cloud model and a small local model side by side, and see
          where the small one holds up — and where it doesn&rsquo;t.
        </p>
      </PageHeader>
      <LabRunner
        tasks={tasks.map((t) => ({ id: t.id, title: t.title, category: t.category, samplePrompt: t.samplePrompt }))}
        history={history}
      />
    </div>
  );
}
