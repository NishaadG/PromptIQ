import { getDb } from "@/lib/server/db";
import { handler, json, requireApiUser } from "@/lib/server/http";
import { getDashboard } from "@/lib/server/services/present";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json(await getDashboard(await getDb(), user));
});
