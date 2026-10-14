import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handler, json } from "@/lib/server/http";
import { verifyCredential } from "@/lib/server/services/certification";

/** Public, unauthenticated verification endpoint for employers and background-check tools. */
export const GET = handler(async (_req: NextRequest, ctx: RouteContext<"/api/credentials/[id]/verify">) => {
  const { id } = await ctx.params;
  const result = await verifyCredential(await getDb(), id);
  return json(result, result.status === "not_found" ? 404 : 200);
});
