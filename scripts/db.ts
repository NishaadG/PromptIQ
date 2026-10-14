/**
 * Database CLI.
 *   npm run db:migrate   apply migrations (to DATABASE_URL, or the local PGlite store)
 *   npm run db:seed      migrate + upsert the item bank + demo users
 *   npm run db:reset     delete the local PGlite store, then seed
 */
import { rmSync } from "node:fs";
import path from "node:path";
import { closeDb, getDb } from "../lib/server/db/client";
import { seed } from "../lib/server/db/seed";

async function main() {
  const cmd = process.argv[2];
  if (cmd === "reset") {
    if (process.env.DATABASE_URL) throw new Error("Refusing to reset a remote DATABASE_URL — reset only touches the local PGlite store.");
    rmSync(path.join(process.cwd(), ".data", "pglite"), { recursive: true, force: true });
    console.log("local database removed");
  }
  const db = await getDb(); // applies migrations
  console.log(`migrations applied (${process.env.DATABASE_URL ? "DATABASE_URL" : "local PGlite at .data/pglite"})`);
  if (cmd === "seed" || cmd === "reset") {
    await seed(db, { demoUsers: process.env.SEED_DEMO_USERS !== "false" });
    console.log("seeded item bank + demo users (login: demo@promptiq.dev / promptiq-demo)");
  }
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
