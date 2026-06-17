import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { fetchDxy, fetchUup, type YahooBar } from "@/lib/yahoo";
import {
  deriveAll,
  isoWeek,
  toDailyV1,
  round2,
  type MergedCandle,
} from "@/lib/derive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How many recent daily rows to pull from the DB as context. Must comfortably
// cover the current month + previous month (for prev_* lags) so the affected
// week/month aggregates are recomputed from complete data.
const CONTEXT_ROWS = 220;

// A same-ET-day candle is treated as final only once UTC time has passed the
// US cash close (the cron runs at 22:30 UTC, well after this).
const CLOSE_CUTOFF_MIN = 21 * 60; // 21:00 UTC

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

function isComplete(bar: YahooBar, gmtoffset: number, nowMs: number): boolean {
  const todayET = new Date(nowMs + gmtoffset * 1000).toISOString().slice(0, 10);
  if (bar.date < todayET) return true;
  if (bar.date > todayET) return false;
  const now = new Date(nowMs);
  return now.getUTCHours() * 60 + now.getUTCMinutes() >= CLOSE_CUTOFF_MIN;
}

interface RunResult {
  status: "success" | "skipped";
  newDates: string[];
  rowsInserted: number;
  rowsUpdated: number;
  latestDate: string | null;
  message: string;
}

async function runUpdate(): Promise<RunResult> {
  const supabase = getAdminSupabase();
  const nowMs = Date.now();

  // 1. Recent DB context (authoritative for historical dates).
  const { data: ctx, error: ctxErr } = await supabase
    .from("dxy_daily_v2")
    .select(
      "full_date,d_open,d_high,d_low,d_close_price,uup_open,uup_high,uup_low,uup_close,uup_volume",
    )
    .order("full_date", { ascending: false })
    .limit(CONTEXT_ROWS);
  if (ctxErr) throw new Error(`DB context read failed: ${ctxErr.message}`);
  const context = (ctx ?? []).slice().reverse();
  const latestDbDate = context.length
    ? String(context[context.length - 1].full_date).slice(0, 10)
    : null;

  // 2. Fetch Yahoo daily series for DXY + UUP.
  const [dxy, uup] = await Promise.all([fetchDxy("6mo"), fetchUup("6mo")]);
  const uupByDate = new Map(uup.bars.map((b) => [b.date, b]));

  // 3. Complete DXY candles strictly newer than what we already store.
  const newBars = dxy.bars.filter(
    (b) =>
      isComplete(b, dxy.gmtoffset, nowMs) &&
      (!latestDbDate || b.date > latestDbDate),
  );

  if (newBars.length === 0) {
    return {
      status: "skipped",
      newDates: [],
      rowsInserted: 0,
      rowsUpdated: 0,
      latestDate: latestDbDate,
      message: "No new complete candle since last update.",
    };
  }

  // 4. Build the derivation window: DB context + new candles (by date).
  const windowByDate = new Map<string, MergedCandle>();
  for (const r of context) {
    const date = String(r.full_date).slice(0, 10);
    windowByDate.set(date, {
      date,
      open: Number(r.d_open),
      high: Number(r.d_high),
      low: Number(r.d_low),
      close: Number(r.d_close_price),
      uupOpen: r.uup_open == null ? null : Number(r.uup_open),
      uupHigh: r.uup_high == null ? null : Number(r.uup_high),
      uupLow: r.uup_low == null ? null : Number(r.uup_low),
      uupClose: r.uup_close == null ? null : Number(r.uup_close),
      uupVolume: r.uup_volume == null ? 0 : Number(r.uup_volume),
    });
  }
  for (const b of newBars) {
    const u = uupByDate.get(b.date);
    windowByDate.set(b.date, {
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      uupOpen: u ? round2(u.open) : null,
      uupHigh: u ? round2(u.high) : null,
      uupLow: u ? round2(u.low) : null,
      uupClose: u ? round2(u.close) : null,
      uupVolume: u ? Math.round(u.volume) : 0,
    });
  }
  const window = [...windowByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // 5. Derive everything; pick the rows touched by the new dates.
  const { daily, weekly, monthly } = deriveAll(window);
  const newDates = new Set(newBars.map((b) => b.date));
  const affectedWeeks = new Set([...newDates].map((d) => isoWeek(d).id));
  const affectedMonths = new Set([...newDates].map((d) => d.slice(0, 7)));

  const stamp = new Date().toISOString();
  const dailyRows = daily.filter(
    (r) => affectedWeeks.has(r.week_id) || affectedMonths.has(r.month_id),
  );
  const weeklyRows = weekly.filter((r) => affectedWeeks.has(r.week_id));
  const monthlyRows = monthly.filter((r) => affectedMonths.has(r.month_id));

  const withStamp = <T extends object>(rows: T[]) =>
    rows.map((r) => ({ ...r, updated_at: stamp }));

  // 6. Upsert (server-side credentials only).
  const upserts: { table: string; rows: object[]; conflict: string }[] = [
    { table: "dxy_daily_v2", rows: withStamp(dailyRows), conflict: "full_date" },
    {
      table: "dxy_daily_v1",
      rows: withStamp(dailyRows.map(toDailyV1)),
      conflict: "full_date",
    },
    { table: "dxy_weekly_v2", rows: withStamp(weeklyRows), conflict: "week_id" },
    {
      table: "dxy_monthly_v2",
      rows: withStamp(monthlyRows),
      conflict: "month_id",
    },
  ];
  for (const u of upserts) {
    if (u.rows.length === 0) continue;
    const { error } = await supabase
      .from(u.table)
      .upsert(u.rows, { onConflict: u.conflict });
    if (error) throw new Error(`Upsert ${u.table} failed: ${error.message}`);
  }

  const latestDate = newBars[newBars.length - 1].date;
  const inserted = newDates.size;
  const updated =
    dailyRows.length - inserted + weeklyRows.length + monthlyRows.length;
  return {
    status: "success",
    newDates: [...newDates].sort(),
    rowsInserted: inserted,
    rowsUpdated: Math.max(0, updated),
    latestDate,
    message: `Inserted ${inserted} day(s); refreshed ${weeklyRows.length} week(s) and ${monthlyRows.length} month(s).`,
  };
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  let runId: number | null = null;
  const { data: runRow } = await supabase
    .from("data_update_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  runId = runRow?.id ?? null;

  try {
    const result = await runUpdate();
    if (runId != null) {
      await supabase
        .from("data_update_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          rows_inserted: result.rowsInserted,
          rows_updated: result.rowsUpdated,
          latest_date: result.latestDate,
        })
        .eq("id", runId);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId != null) {
      await supabase
        .from("data_update_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "failed",
          error_message: message.slice(0, 500),
        })
        .eq("id", runId);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export function GET(req: Request) {
  return handle(req);
}

export function POST(req: Request) {
  return handle(req);
}
