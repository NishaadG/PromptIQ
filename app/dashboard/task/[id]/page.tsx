import { notFound } from "next/navigation";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { getTask, toClientTask } from "@/lib/server/services/catalog";
import { TaskRunner } from "@/components/TaskRunner";
import { count, and, eq } from "drizzle-orm";
import { attempts } from "@/lib/server/db/schema";

export default async function TaskPage(props: PageProps<"/dashboard/task/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const db = await getDb();
  const task = await getTask(db, id);
  if (!task) notFound();
  const [{ n }] = await db.select({ n: count() }).from(attempts).where(and(eq(attempts.userId, user.id), eq(attempts.taskId, id)));
  return <TaskRunner task={toClientTask(task)} balance={user.tokens} priorAttempts={n} />;
}
