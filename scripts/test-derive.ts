import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { deriveAll, toDailyV1, type MergedCandle } from "../lib/derive";

function rows(path: string): Record<string, string>[] {
  return parse(readFileSync(path), { columns: true, skip_empty_lines: true, bom: true });
}

const dailyCsv = rows("data/v2/dxy_daily_v2.csv");
const weeklyCsv = rows("data/v2/dxy_weekly_v2.csv");
const monthlyCsv = rows("data/v2/dxy_monthly_v2.csv");
const v1Csv = rows("data/v1/dxy_daily_v1.csv");

const num = (s: string) => (s === "" || s === undefined ? null : Number(s));
const window: MergedCandle[] = dailyCsv.map((r) => ({
  date: r.full_date,
  open: Number(r.d_open),
  high: Number(r.d_high),
  low: Number(r.d_low),
  close: Number(r.d_close_price),
  uupOpen: num(r.uup_open),
  uupHigh: num(r.uup_high),
  uupLow: num(r.uup_low),
  uupClose: num(r.uup_close),
  uupVolume: Number(r.uup_volume || 0),
}));

const { daily, weekly, monthly } = deriveAll(window);

let totalMismatch = 0;
const colMismatch = new Map<string, number>();
const sample = new Map<string, string>();

function cmp(table: string, key: string, col: string, got: unknown, exp: string) {
  // Normalise for comparison.
  let g: string;
  if (got === null || got === undefined) g = "";
  else if (typeof got === "boolean") g = got ? "1" : "0";
  else g = String(got);
  const e = exp ?? "";
  // numeric tolerance for decimals
  if (g !== e && /^-?\d+(\.\d+)?$/.test(g) && /^-?\d+(\.\d+)?$/.test(e)) {
    if (Math.abs(Number(g) - Number(e)) < 1e-9) return;
  }
  if (g !== e) {
    totalMismatch++;
    const ck = `${table}.${col}`;
    colMismatch.set(ck, (colMismatch.get(ck) ?? 0) + 1);
    if (!sample.has(ck)) sample.set(ck, `${key}: got=${JSON.stringify(g)} exp=${JSON.stringify(e)}`);
  }
}

// Daily v2
const dCsvBy = new Map(dailyCsv.map((r) => [r.full_date, r]));
const dailyCols = Object.keys(dailyCsv[0]);
for (const row of daily) {
  const exp = dCsvBy.get(row.full_date);
  if (!exp) continue;
  for (const col of dailyCols) {
    if (col === "uup_open" || col === "uup_high" || col === "uup_low" || col === "uup_close") continue;
    cmp("daily", row.full_date, col, (row as unknown as Record<string, unknown>)[col], exp[col]);
  }
}

// Weekly
const wCsvBy = new Map(weeklyCsv.map((r) => [r.week_id, r]));
const weeklyCols = Object.keys(weeklyCsv[0]);
for (const row of weekly) {
  const exp = wCsvBy.get(row.week_id);
  if (!exp) continue;
  for (const col of weeklyCols) cmp("weekly", row.week_id, col, (row as unknown as Record<string, unknown>)[col], exp[col]);
}

// Monthly
const mCsvBy = new Map(monthlyCsv.map((r) => [r.month_id, r]));
const monthlyCols = Object.keys(monthlyCsv[0]);
for (const row of monthly) {
  const exp = mCsvBy.get(row.month_id);
  if (!exp) continue;
  for (const col of monthlyCols) cmp("monthly", row.month_id, col, (row as unknown as Record<string, unknown>)[col], exp[col]);
}

// V1 projection (CSV uses display-name headers -> map to db columns)
const v1Map: Record<string, string> = {
  d_range: "D range", d_close: "D close", daily_profile: "daily profile",
  w_close: "W close", w_range: "W range", w_daily_match: "W&Daily match",
  wh: "WH", wl: "WL", m_close: "M Close", m_d_match: "M & D match",
  m_w_match: "M and W match", event_week: "event_week", cpi_week: "cpi_week",
  nfp_week: "nfp_week", cpi_release_date_est: "cpi_release_date_est",
  nfp_release_date_est: "nfp_release_date_est", calendar_source: "calendar_source",
};
const v1CsvBy = new Map(v1Csv.map((r) => [r.full_date, r]));
for (const row of daily) {
  const v1 = toDailyV1(row) as Record<string, unknown>;
  const exp = v1CsvBy.get(row.full_date);
  if (!exp) continue;
  for (const [dbCol, csvCol] of Object.entries(v1Map)) {
    cmp("v1", row.full_date, dbCol, v1[dbCol], exp[csvCol]);
  }
}

console.log("Rows: daily", daily.length, "weekly", weekly.length, "monthly", monthly.length);
console.log("Total mismatches:", totalMismatch);
for (const [col, n] of [...colMismatch.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${col}: ${n}  e.g. ${sample.get(col)}`);
}
