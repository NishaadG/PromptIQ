import { cookies } from "next/headers";
import { getDb } from "@/lib/server/db";
import { deleteSession, SESSION_COOKIE } from "@/lib/server/auth/sessions";
import { clearSessionCookie } from "@/lib/server/dal";
import { handler, json } from "@/lib/server/http";

export const POST = handler(async () => {
  await deleteSession(await getDb(), (await cookies()).get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  return json({ ok: true });
});
