/**
 * Database client. Two interchangeable drivers, same schema and migrations:
 *
 *  - DATABASE_URL unset  -> PGlite: an embedded Postgres (WASM) stored in .data/pglite.
 *                           Zero install, zero accounts — ideal for local dev and tests.
 *  - DATABASE_URL set    -> postgres-js against any Postgres (e.g. a free Neon database).
 *
 * Migrations in ./migrations are applied automatically on first use (set DB_AUTO_MIGRATE=false
 * to disable, e.g. when running `npm run db:migrate` as a separate deploy step).
 *
 * This module has no "server-only" import so that CLI scripts and tests can use it; app code
 * should import from "@/lib/server/db" instead.
 */
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "lib", "server", "db", "migrations");

type Holder = { db?: Promise<DB>; close?: () => Promise<void> };
const g = globalThis as unknown as { __promptiqDb?: Holder };
const holder: Holder = (g.__promptiqDb ??= {}); // survive dev hot-reloads

async function create(url = process.env.DATABASE_URL, dataDir?: string): Promise<{ db: DB; close: () => Promise<void> }> {
  const autoMigrate = process.env.DB_AUTO_MIGRATE !== "false";
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 5), prepare: false });
    const db = drizzle(client, { schema });
    if (autoMigrate) {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS });
    }
    return { db: db as unknown as DB, close: () => client.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = dataDir ?? process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dir !== "memory") (await import("node:fs")).mkdirSync(dir, { recursive: true }); // PGlite won't create parents
  const client = dir === "memory" ? new PGlite() : new PGlite(dir);
  const db = drizzle(client, { schema });
  if (autoMigrate) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS });
  }
  return { db: db as unknown as DB, close: () => client.close() };
}

export function getDb(): Promise<DB> {
  if (!holder.db) {
    holder.db = create().then(({ db, close }) => {
      holder.close = close;
      return db;
    });
    holder.db.catch(() => (holder.db = undefined)); // allow a retry after a failed connect
  }
  return holder.db;
}

/** Fresh, isolated database (in-memory PGlite) — for tests. */
export async function createTestDb() {
  return create(undefined, "memory");
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.close = undefined;
}
