# DXY Research Platform

A public research dashboard for the **US Dollar Index (DXY)**. It surfaces daily,
weekly, and monthly price-action patterns over ~40 years of history and includes
a chat-style AI assistant that answers trading-pattern questions by running exact
queries against the database (it never invents numbers).

Built with the Next.js App Router and Supabase Postgres. No paid market-data or
LLM API keys are required. Data is kept current by a daily cron that pulls from
the free Yahoo Finance chart endpoint.

- **DXY OHLC source:** Yahoo Finance `DX-Y.NYB`
- **Volume source:** `UUP` ETF proxy (the DXY index itself reports no volume)
- **CPI / NFP event dates:** estimated from calendar rules

## Versions

A root selector at `/` chooses between two versions:

- **V1 — Original dashboard** (`/v1`, `/v1/data`, `/v1/patterns`, `/v1/methodology`):
  latest daily row, daily/weekly/monthly close bias, a filterable history table,
  and basic pattern stats.
- **V2 — Expanded research + AI** (`/v2`, `/v2/data`, `/v2/patterns`, `/v2/ai`,
  `/v2/methodology`): separate daily/weekly/monthly datasets, a dataset switcher,
  weekly pattern stats, a CPI/NFP/normal week comparison, and the AI assistant.

## AI assistant (`/v2/ai`)

Ask questions in plain English, e.g. *"What was the weekly close when the high of
the week was Monday and the monthly close was bearish?"*. The assistant:

1. Converts the question to a structured query plan
   (`{ dataset, targetField, filters: [{ field, op, value }] }`). A deterministic
   parser handles common phrasing; an optional local Ollama model
   (`qwen2.5-coder:7b`, used only if `OLLAMA_HOST` is set) can translate harder
   phrasings to the same JSON.
2. Executes the query against Supabase and **counts the distribution in code** —
   the model never calculates the final statistics.
3. Replies like a research assistant and shows the supporting plan, distribution,
   and sample rows for auditability.

Chat memory is browser-session only (React state); it is never written to the
database and is cleared on refresh.

## Tech stack

- Next.js (App Router) + React, Tailwind CSS v4
- Supabase Postgres (`@supabase/supabase-js`), public read via RLS
- Server components read directly through `lib/query` + `lib/stats`; client
  components call `/api/query` and `/api/ai`
- Daily update cron at `/api/cron/daily-update`, scheduled by `vercel.json`

## Project layout

```
app/                 routes (root selector, /v1/*, /v2/*, /api/*)
components/           UI + client components (DataExplorer, AiChat, ...)
lib/                  query engine, dataset metadata, stats, AI layers
lib/derive.ts         pure feature-engineering used by the cron
lib/yahoo.ts          Yahoo Finance chart fetch (no key)
scripts/              schema apply + CSV import + derive validation
supabase/schema.sql   tables, indexes, RLS policies
data/                 source CSVs (v1 + v2) for the initial import
```

## Environment

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key (public, read-only via RLS) |
| `SUPABASE_SECRET_KEY` | Service/secret key — **server-side only**, used for cron upserts |
| `SUPABASE_DB_PASSWORD` | Postgres password for the import scripts |
| `SUPABASE_DB_HOST` / `SUPABASE_DB_PORT` | IPv4 session-pooler host for scripts (the direct DB host is IPv6-only) |
| `CRON_SECRET` | Protects `/api/cron/daily-update` |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | Optional local LLM for NL→JSON parsing |

The secret key is only read in server code (cron route) and is never shipped to
the browser.

## Setup

```bash
npm install

# One-time: apply schema + import the CSVs into your Supabase project
npm run db:setup      # = db:schema then db:import

npm run dev           # http://localhost:3000
```

Useful scripts: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run db:schema`, `npm run db:import`. `tsx scripts/test-derive.ts` validates
the derivation module against the historical CSVs.

## Daily updates

`vercel.json` schedules `GET /api/cron/daily-update` at `30 22 * * *` (UTC),
after the New York close. The route:

- fetches the latest `DX-Y.NYB` and `UUP` daily candles from Yahoo,
- excludes the partial current-day candle,
- re-derives the affected daily/weekly/monthly rows with `lib/derive.ts`,
- upserts them with the server-side secret key, and
- records each run in `data_update_runs`.

It is protected by `CRON_SECRET` (Vercel sends it as `Authorization: Bearer`; for
manual runs use `?secret=...` or the `x-cron-secret` header).

## Deployment

Designed for Vercel: import the repo, set the environment variables above, and the
cron in `vercel.json` is picked up automatically.
