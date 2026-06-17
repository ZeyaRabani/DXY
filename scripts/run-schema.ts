import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makePool } from "./db";

// Splits the schema into individual statements. The schema contains no
// dollar-quoted bodies or semicolons inside literals, so a simple split is safe.
function splitStatements(sql: string): string[] {
  // Strip line comments first so leading comments don't get attached to (and
  // wrongly filter out) the first real statement.
  const stripped = sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  return stripped
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Postgres error codes that mean "this object already exists" — safe to ignore
// so the script is idempotent (e.g. CREATE POLICY has no IF NOT EXISTS).
const IGNORABLE = new Set(["42710", "42P07", "42P06", "42723"]);

async function main() {
  const sqlPath = resolve(process.cwd(), "supabase/schema.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const statements = splitStatements(sql);
  const pool = makePool();
  const client = await pool.connect();
  let applied = 0;
  let skipped = 0;
  try {
    console.log(`Applying ${statements.length} statements from ${sqlPath} ...`);
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        applied += 1;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code && IGNORABLE.has(code)) {
          skipped += 1;
          continue;
        }
        console.error("Failed statement:\n", stmt);
        throw err;
      }
    }
    console.log(`Schema applied. ${applied} statements run, ${skipped} already existed.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Schema application failed:", err.message ?? err);
  process.exit(1);
});
