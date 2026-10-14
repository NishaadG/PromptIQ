import "server-only";
import { getDb, type DB } from "./client";

export { getDb };
export type { DB };
export * as schema from "./schema";
