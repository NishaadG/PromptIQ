import { sql } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { getProvider } from "@/lib/server/llm";

export async function GET() {
  try {
    await (await getDb()).execute(sql`select 1`);
    return Response.json({ ok: true, db: process.env.DATABASE_URL ? "postgres" : "pglite", llm: getProvider().name });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
