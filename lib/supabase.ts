import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public Supabase config. The publishable/anon key is safe to expose to the browser;
// row level security restricts it to read-only access on the public tables.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";
// Server-only. Never expose to the browser. Used for upserts in the cron route.
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let browserClient: SupabaseClient | null = null;

// Singleton client for use in client components (read-only, anon key).
export function getBrowserSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return browserClient;
}

// Read client for server components and route handlers (anon key + RLS).
export function getServerSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

// Privileged client for server-side writes (cron upserts). Falls back to the
// anon client only if no secret key is configured.
export function getAdminSupabase(): SupabaseClient {
  const key = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}
