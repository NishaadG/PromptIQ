import { getDb } from "@/lib/server/db";
import { handler, rateLimit, requireApiUser } from "@/lib/server/http";
import { exportAccount } from "@/lib/server/services/accounts";

/** Download everything PromptIQ stores about you as JSON. */
export const GET = handler(async () => {
  const user = await requireApiUser();
  rateLimit(`export:${user.id}`, 5, 60_000);
  const data = await exportAccount(await getDb(), user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="promptiq-${user.handle}.json"`,
      "cache-control": "no-store",
    },
  });
});
