import { toPublicUser } from "@/lib/server/dal";
import { handler, json, requireApiUser } from "@/lib/server/http";

export const GET = handler(async () => json({ user: toPublicUser(await requireApiUser()) }));
