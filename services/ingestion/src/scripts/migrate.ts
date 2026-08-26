/**
 * Applies pending SQL migrations to an existing database.
 *
 * Docker's `docker-entrypoint-initdb.d` only runs on a *fresh* volume, so every
 * migration after the first has had to be applied by hand to any database that already
 * existed. That works exactly once per developer and then silently rots: a database
 * created before a migration landed simply lacks the column, and the failure surfaces
 * later as a confusing query error rather than as "you are behind".
 *
 * This records what has been applied in `schema_migrations` and runs the rest, in
 * filename order, each inside a transaction. Re-running is safe: applied files are
 * skipped, and the migrations themselves are written to be idempotent.
 *
 * Usage:  pnpm migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { config } from "../config";

// __dirname rather than import.meta.url: this package compiles to CommonJS, so
// import.meta is not available to it.
const MIGRATIONS_DIR = resolve(__dirname, "../../../../database/migrations");

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: config.databaseUrl, max: 2 });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations")).rows.map(
      (row) => row.filename,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("migrate: no migration files found");
    await pool.end();
    return;
  }

  let ran = 0;

  for (const filename of files) {
    if (applied.has(filename)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`migrate: applied ${filename}`);
      ran += 1;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`migration ${filename} failed: ${message}`);
    } finally {
      client.release();
    }
  }

  console.log(
    ran === 0
      ? `migrate: up to date (${files.length} migrations already applied)`
      : `migrate: applied ${ran} migration${ran === 1 ? "" : "s"}`,
  );

  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
