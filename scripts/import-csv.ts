import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import type { Pool } from "pg";
import { makePool } from "./db";
import { TABLE_DEFS, coerce, type TableDef } from "./tables";

const BATCH = 400;

async function importTable(pool: Pool, def: TableDef): Promise<number> {
  const csvPath = resolve(process.cwd(), def.csv);
  const text = readFileSync(csvPath, "utf8");
  const records: Record<string, string>[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });

  const cols = def.columns.map(([col]) => col);
  const updateCols = cols.filter((c) => c !== def.primaryKey);
  const setClause = updateCols
    .map((c) => `${c} = excluded.${c}`)
    .concat("updated_at = now()")
    .join(", ");

  let imported = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const values: unknown[] = [];
    const tuples: string[] = [];
    chunk.forEach((rec, r) => {
      const ph: string[] = [];
      def.columns.forEach(([, type, csv], c) => {
        const header = csv ?? def.columns[c][0];
        values.push(coerce(rec[header], type));
        ph.push(`$${r * cols.length + c + 1}`);
      });
      tuples.push(`(${ph.join(", ")})`);
    });
    const sql =
      `insert into public.${def.table} (${cols.join(", ")}) values ` +
      `${tuples.join(", ")} ` +
      `on conflict (${def.primaryKey}) do update set ${setClause}`;
    await pool.query(sql, values);
    imported += chunk.length;
    process.stdout.write(`\r  ${def.table}: ${imported}/${records.length}`);
  }
  process.stdout.write("\n");
  return imported;
}

async function main() {
  const pool = makePool();
  try {
    for (const def of TABLE_DEFS) {
      console.log(`Importing ${def.csv} -> ${def.table}`);
      const n = await importTable(pool, def);
      const { rows } = await pool.query(`select count(*)::int as c from public.${def.table}`);
      console.log(`  done: imported ${n}, table now has ${rows[0].c} rows`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\nImport failed:", err.message ?? err);
  process.exit(1);
});
