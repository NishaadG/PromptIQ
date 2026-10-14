import { getDb } from "@/lib/server/db";
import { handler, json, requireApiUser } from "@/lib/server/http";
import { listTasksForUser } from "@/lib/server/services/catalog";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ tasks: await listTasksForUser(await getDb(), user.id) });
});
