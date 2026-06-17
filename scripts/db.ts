import { config as loadEnv } from "dotenv";
import { Pool, type PoolConfig } from "pg";

// Load local env (.env.local preferred, then .env) for standalone scripts.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function projectRef(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const m = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (m) return m[1];
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  throw new Error(
    "Cannot determine Supabase project ref. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PROJECT_REF.",
  );
}

export function makePool(): Pool {
  const explicit = process.env.SUPABASE_DB_URL;
  let cfg: PoolConfig;
  if (explicit) {
    cfg = { connectionString: explicit, ssl: { rejectUnauthorized: false } };
  } else {
    const password = process.env.SUPABASE_DB_PASSWORD;
    if (!password) {
      throw new Error(
        "Set SUPABASE_DB_PASSWORD (or SUPABASE_DB_URL) before running DB scripts.",
      );
    }
    const ref = projectRef();
    // The direct host (db.<ref>.supabase.co) is IPv6-only; many networks can't
    // reach it. The Supabase session pooler is IPv4. Prefer the pooler host when
    // configured (SUPABASE_DB_HOST), otherwise fall back to the direct host.
    const poolerHost = process.env.SUPABASE_DB_HOST;
    if (poolerHost) {
      cfg = {
        host: poolerHost,
        port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
        user: `postgres.${ref}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      };
    } else {
      cfg = {
        host: `db.${ref}.supabase.co`,
        port: 5432,
        user: "postgres",
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      };
    }
  }
  cfg.max = 4;
  cfg.connectionTimeoutMillis = 15000;
  return new Pool(cfg);
}
