import { redirect } from "next/navigation";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { recommendTask } from "@/lib/server/services/catalog";

// Legacy URL from the demo: send the learner to the task recommended for their level.
export default async function TaskIndex() {
  const user = await requireUser();
  const next = await recommendTask(await getDb(), user.id, user.rating);
  redirect(next ? `/dashboard/task/${next.id}` : "/dashboard/tasks");
}
