import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/dal";
import { handler, json } from "@/lib/server/http";
import { leaderboard } from "@/lib/server/services/catalog";

export const GET = handler(async (req: NextRequest) => {
  const period = req.nextUrl.searchParams.get("period") === "week" ? "week" : "all";
  const user = await getCurrentUser();
  return json({ period, rows: await leaderboard(await getDb(), { period, currentUserId: user?.id }) });
});
