// Pure feature-engineering used by the daily updater. Reverse-engineered from
// and validated against the original handoff CSVs so newly fetched candles get
// exactly the same derived columns as the historical rows.

export type Bias = "bullish" | "bearish";

export interface MergedCandle {
  date: string; // YYYY-MM-DD (exchange calendar date)
  open: number;
  high: number;
  low: number;
  close: number;
  uupOpen: number | null;
  uupHigh: number | null;
  uupLow: number | null;
  uupClose: number | null;
  uupVolume: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_TOK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const VOLUME_SOURCE = "UUP ETF proxy";
const CALENDAR_SOURCE = "estimated_rule";
const SOURCE_SYMBOL = "DX-Y.NYB";
const SOURCE_PROVIDER = "Yahoo Finance chart API";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Index "points": price diff * 1000 (so 0.01 = 10 points), rounded.
function pts(a: number, b: number): number {
  return Math.round((a - b) * 1000);
}

function biasOf(open: number, close: number): Bias {
  return close >= open ? "bullish" : "bearish";
}

// round(100*a/b, 2) using Python/pandas banker's rounding (round half to even),
// computed in integer space to avoid float noise at the .xx5 boundary.
function pct2(a: number, b: number): number {
  if (b === 0) return 0;
  const N = 10000 * a;
  const q = Math.floor(N / b);
  const rem = N - q * b;
  let n = q;
  if (2 * rem > b) n = q + 1;
  else if (2 * rem === b) n = q % 2 === 0 ? q : q + 1;
  return n / 100;
}

// Unrounded percentage used only for profile size/location categorisation.
function pctRaw(a: number, b: number): number {
  if (b === 0) return 0;
  return (100 * a) / b;
}

// round(100*a/b, 2) half-up from full-precision values. Used for close-position
// percentages, which the source pipeline derived before rounding OHLC to 2dp.
function pctFull(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round(((100 * a) / b) * 100) / 100;
}

export function dailyRangeBucket(r: number): string {
  if (r < 350) return "<350";
  if (r < 500) return "350-499";
  if (r < 700) return "500-699";
  if (r < 900) return "700-899";
  if (r < 1200) return "900-1199";
  return ">=1200";
}
export function weeklyRangeBucket(r: number): string {
  if (r < 850) return "<850";
  if (r < 1100) return "850-1099";
  if (r < 1350) return "1100-1349";
  if (r < 1700) return "1350-1699";
  if (r < 2200) return "1700-2199";
  return ">=2200";
}
export function monthlyRangeBucket(r: number): string {
  if (r < 1600) return "<1600";
  if (r < 2200) return "1600-2199";
  if (r < 2800) return "2200-2799";
  if (r < 3600) return "2800-3599";
  if (r < 4800) return "3600-4799";
  return ">=4800";
}

// Size category from a percentage-of-range value (used for body + both wicks).
function sizeCat(pct: number): string {
  if (pct === 0) return "none";
  if (pct < 12) return "tiny";
  if (pct < 35) return "small";
  if (pct < 65) return "medium";
  return "large";
}
function locText(cpos: number): string {
  if (cpos <= 25) return "low";
  if (cpos >= 75) return "high";
  return "middle of the range";
}

function dailyProfile(
  dir: Bias,
  range: number,
  bodyPct: number,
  uwPct: number,
  lwPct: number,
  cpos: number,
): string {
  if (range === 0) return "Flat daily candle with no meaningful range.";
  const Dir = dir === "bullish" ? "Bullish" : "Bearish";
  return `${Dir} daily candle, ${sizeCat(bodyPct)} body, ${sizeCat(uwPct)} upper wick, ${sizeCat(lwPct)} lower wick, closed near the ${locText(cpos)}.`;
}

function utc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function weekdayTok(dateStr: string): string {
  return WEEKDAY_TOK[utc(dateStr).getUTCDay()];
}

// ISO week id like "2026-W24", plus the ISO year/week numbers.
export function isoWeek(dateStr: string): { id: string; year: number; week: number } {
  const d = utc(dateStr);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - day + 3);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { id: `${year}-W${String(week).padStart(2, "0")}`, year, week };
}

function isoMonday(dateStr: string): Date {
  const d = utc(dateStr);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

// CPI estimate. 1986-2002: third Wednesday of the month. 2003+: the 11th,
// rolled forward to Monday if it lands on a weekend.
function cpiEstimate(year: number, monthIdx0: number): Date {
  if (year <= 2002) {
    const d = new Date(Date.UTC(year, monthIdx0, 1));
    while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1); // first Wednesday
    d.setUTCDate(d.getUTCDate() + 14); // -> third Wednesday
    return d;
  }
  const d = new Date(Date.UTC(year, monthIdx0, 11));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

interface EventTags {
  event_type: string;
  event_week: boolean;
  cpi_week: boolean;
  nfp_week: boolean;
  cpi_release_date_est: string | null;
  nfp_release_date_est: string | null;
  calendar_source: string;
}

// Week-level event tagging from the ISO week's Monday..Sunday window.
function eventTags(dateStr: string): EventTags {
  const monday = isoMonday(dateStr);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);

  // NFP: first Friday of its month -> the week's Friday has day-of-month <= 7.
  const nfp = friday.getUTCDate() <= 7;
  const nfpDate = nfp ? iso(friday) : null;

  // CPI: 11th-roll date for the month(s) the week touches, inside the window.
  let cpiDate: string | null = null;
  const candidates = [
    cpiEstimate(monday.getUTCFullYear(), monday.getUTCMonth()),
    cpiEstimate(sunday.getUTCFullYear(), sunday.getUTCMonth()),
  ];
  for (const c of candidates) {
    if (c >= monday && c <= sunday) {
      cpiDate = iso(c);
      break;
    }
  }
  const cpi = cpiDate !== null;
  const event_type = cpi && nfp ? "both" : cpi ? "cpi" : nfp ? "nfp" : "normal";
  return {
    event_type,
    event_week: cpi || nfp,
    cpi_week: cpi,
    nfp_week: nfp,
    cpi_release_date_est: cpiDate,
    nfp_release_date_est: nfpDate,
    calendar_source: CALENDAR_SOURCE,
  };
}

export interface DailyV2Row {
  full_date: string;
  year: number;
  month: string;
  month_number: number;
  day: string;
  date: number;
  day_of_month: number;
  week_of_month: number;
  quarter: number;
  d_open: number;
  d_high: number;
  d_low: number;
  d_close_price: number;
  d_range: number;
  d_range_bucket: string;
  d_close: Bias;
  body_points: number;
  upper_wick_points: number;
  lower_wick_points: number;
  body_pct_of_range: number;
  close_position_pct: number;
  daily_profile: string;
  prev_day_close: Bias | null;
  prev_day_range: number | null;
  inside_day: boolean | null;
  outside_day: boolean | null;
  break_prev_day_high: boolean | null;
  break_prev_day_low: boolean | null;
  uup_open: number | null;
  uup_high: number | null;
  uup_low: number | null;
  uup_close: number | null;
  uup_volume: number;
  volume_source: string;
  week_id: string;
  month_id: string;
  w_close: Bias;
  w_range: number;
  w_range_bucket: string;
  w_daily_match: boolean;
  wh: string;
  wl: string;
  m_close: Bias;
  m_d_match: boolean;
  m_w_match: boolean;
  event_type: string;
  event_week: boolean;
  cpi_week: boolean;
  nfp_week: boolean;
  cpi_release_date_est: string | null;
  nfp_release_date_est: string | null;
  calendar_source: string;
  source_symbol: string;
  source_provider: string;
}

export interface WeeklyRow {
  week_id: string;
  week_start: string;
  week_end: string;
  iso_year: number;
  iso_week: number;
  w_open: number;
  w_high: number;
  w_low: number;
  w_close_price: number;
  w_range: number;
  w_range_bucket: string;
  w_close: Bias;
  wh: string;
  wl: string;
  w_body_points: number;
  w_upper_wick_points: number;
  w_lower_wick_points: number;
  w_close_position_pct: number;
  daily_bullish_count: number;
  daily_bearish_count: number;
  trading_days: number;
  uup_volume_sum: number;
  uup_volume_avg: number;
  prev_week_close: Bias | null;
  prev_week_range: number | null;
  prev_week_range_bucket: string | null;
  event_type: string;
  event_week: boolean;
  cpi_week: boolean;
  nfp_week: boolean;
  cpi_release_date_est: string | null;
  nfp_release_date_est: string | null;
  calendar_source: string;
  month_id: string;
  m_close: Bias | null;
  m_range: number | null;
  m_range_bucket: string | null;
}

export interface MonthlyRow {
  month_id: string;
  month_start: string;
  month_end: string;
  year: number;
  month: string;
  month_number: number;
  m_open: number;
  m_high: number;
  m_low: number;
  m_close_price: number;
  m_range: number;
  m_range_bucket: string;
  m_close: Bias;
  weekly_bullish_count: number;
  weekly_bearish_count: number;
  trading_days: number;
  uup_volume_sum: number;
  uup_volume_avg: number;
  prev_month_close: Bias | null;
  prev_month_range: number | null;
  prev_month_range_bucket: string | null;
}

export interface DerivedAll {
  daily: DailyV2Row[];
  weekly: WeeklyRow[];
  monthly: MonthlyRow[];
}

// Build all derived rows from a chronologically sorted window of merged candles.
export function deriveAll(window: MergedCandle[]): DerivedAll {
  const sorted = [...window].sort((a, b) => a.date.localeCompare(b.date));

  // --- Monthly aggregation (calendar month of each daily candle) ---
  const monthGroups = new Map<string, MergedCandle[]>();
  for (const c of sorted) {
    const mid = c.date.slice(0, 7);
    (monthGroups.get(mid) ?? monthGroups.set(mid, []).get(mid)!).push(c);
  }
  const monthly: MonthlyRow[] = [];
  const monthlyById = new Map<string, MonthlyRow>();
  const monthIds = [...monthGroups.keys()].sort();
  for (let i = 0; i < monthIds.length; i++) {
    const mid = monthIds[i];
    const rows = monthGroups.get(mid)!;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const high = round2(Math.max(...rows.map((r) => r.high)));
    const low = round2(Math.min(...rows.map((r) => r.low)));
    const open = round2(first.open);
    const close = round2(last.close);
    const range = pts(high, low);
    const [y, mnum] = mid.split("-").map(Number);
    const sum = rows.reduce((s, r) => s + r.uupVolume, 0);
    const prev = i > 0 ? monthlyById.get(monthIds[i - 1]) ?? null : null;
    const row: MonthlyRow = {
      month_id: mid,
      month_start: first.date,
      month_end: last.date,
      year: y,
      month: MONTH_NAMES[mnum - 1],
      month_number: mnum,
      m_open: open,
      m_high: high,
      m_low: low,
      m_close_price: close,
      m_range: range,
      m_range_bucket: monthlyRangeBucket(range),
      m_close: biasOf(open, close),
      weekly_bullish_count: 0,
      weekly_bearish_count: 0,
      trading_days: rows.length,
      uup_volume_sum: sum,
      uup_volume_avg: Math.round(sum / rows.length),
      prev_month_close: prev ? prev.m_close : null,
      prev_month_range: prev ? prev.m_range : null,
      prev_month_range_bucket: prev ? prev.m_range_bucket : null,
    };
    monthly.push(row);
    monthlyById.set(mid, row);
  }

  // --- Weekly aggregation (ISO week) ---
  const weekGroups = new Map<string, MergedCandle[]>();
  for (const c of sorted) {
    const wid = isoWeek(c.date).id;
    (weekGroups.get(wid) ?? weekGroups.set(wid, []).get(wid)!).push(c);
  }
  const weekly: WeeklyRow[] = [];
  const weeklyById = new Map<string, WeeklyRow>();
  const weekIds = [...weekGroups.keys()].sort((a, b) => {
    const wa = weekGroups.get(a)![0].date;
    const wb = weekGroups.get(b)![0].date;
    return wa.localeCompare(wb);
  });
  for (let i = 0; i < weekIds.length; i++) {
    const wid = weekIds[i];
    const rows = weekGroups.get(wid)!;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const fHigh = Math.max(...rows.map((r) => r.high));
    const fLow = Math.min(...rows.map((r) => r.low));
    const high = round2(fHigh);
    const low = round2(fLow);
    const wOpen = round2(first.open);
    const wClosePrice = round2(last.close);
    const range = pts(high, low);
    const close = biasOf(wOpen, wClosePrice);
    const body = pts(Math.max(wOpen, wClosePrice), Math.min(wOpen, wClosePrice));
    const upper = pts(high, Math.max(wOpen, wClosePrice));
    const lower = pts(Math.min(wOpen, wClosePrice), low);
    const whRow = rows.reduce((m, r) => (r.high > m.high ? r : m), rows[0]);
    const wlRow = rows.reduce((m, r) => (r.low < m.low ? r : m), rows[0]);
    const sum = rows.reduce((s, r) => s + r.uupVolume, 0);
    const { year, week } = isoWeek(first.date);
    const monthId = last.date.slice(0, 7); // by last trading day
    const parentMonth = monthlyById.get(monthId) ?? null;
    const prev = i > 0 ? weeklyById.get(weekIds[i - 1]) ?? null : null;
    const tags = eventTags(first.date);
    const row: WeeklyRow = {
      week_id: wid,
      week_start: first.date,
      week_end: last.date,
      iso_year: year,
      iso_week: week,
      w_open: wOpen,
      w_high: high,
      w_low: low,
      w_close_price: wClosePrice,
      w_range: range,
      w_range_bucket: weeklyRangeBucket(range),
      w_close: close,
      wh: weekdayTok(whRow.date),
      wl: weekdayTok(wlRow.date),
      w_body_points: body,
      w_upper_wick_points: upper,
      w_lower_wick_points: lower,
      w_close_position_pct: pctFull(last.close - fLow, fHigh - fLow),
      daily_bullish_count: rows.filter((r) => biasOf(r.open, r.close) === "bullish").length,
      daily_bearish_count: rows.filter((r) => biasOf(r.open, r.close) === "bearish").length,
      trading_days: rows.length,
      uup_volume_sum: sum,
      uup_volume_avg: Math.round(sum / rows.length),
      prev_week_close: prev ? prev.w_close : null,
      prev_week_range: prev ? prev.w_range : null,
      prev_week_range_bucket: prev ? prev.w_range_bucket : null,
      ...tags,
      month_id: monthId,
      m_close: parentMonth ? parentMonth.m_close : null,
      m_range: parentMonth ? parentMonth.m_range : null,
      m_range_bucket: parentMonth ? parentMonth.m_range_bucket : null,
    };
    weekly.push(row);
    weeklyById.set(wid, row);
  }

  // --- Daily rows (with prev-day context + denormalised week/month fields) ---
  const daily: DailyV2Row[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const o = round2(c.open);
    const h = round2(c.high);
    const l = round2(c.low);
    const cp = round2(c.close);
    const range = pts(h, l);
    const body = pts(Math.max(o, cp), Math.min(o, cp));
    const upper = pts(h, Math.max(o, cp));
    const lower = pts(Math.min(o, cp), l);
    const bodyPct = pct2(body, range);
    const cpos = pctFull(c.close - c.low, c.high - c.low);
    const dClose = biasOf(o, cp);
    const ph = prev ? round2(prev.high) : 0;
    const pl = prev ? round2(prev.low) : 0;
    const wid = isoWeek(c.date).id;
    const mid = c.date.slice(0, 7);
    const wk = weeklyById.get(wid)!;
    const mo = monthlyById.get(mid)!;
    const [y, mnum, dom] = c.date.split("-").map(Number);
    const tags = eventTags(c.date);
    daily.push({
      full_date: c.date,
      year: y,
      month: MONTH_NAMES[mnum - 1],
      month_number: mnum,
      day: weekdayTok(c.date),
      date: dom,
      day_of_month: dom,
      week_of_month: Math.floor((dom - 1) / 7) + 1,
      quarter: Math.floor((mnum - 1) / 3) + 1,
      d_open: o,
      d_high: h,
      d_low: l,
      d_close_price: cp,
      d_range: range,
      d_range_bucket: dailyRangeBucket(range),
      d_close: dClose,
      body_points: body,
      upper_wick_points: upper,
      lower_wick_points: lower,
      body_pct_of_range: bodyPct,
      close_position_pct: cpos,
      daily_profile: dailyProfile(
        dClose,
        range,
        pctRaw(Math.abs(c.close - c.open), c.high - c.low),
        pctRaw(c.high - Math.max(c.open, c.close), c.high - c.low),
        pctRaw(Math.min(c.open, c.close) - c.low, c.high - c.low),
        pctRaw(c.close - c.low, c.high - c.low),
      ),
      prev_day_close: prev ? biasOf(round2(prev.open), round2(prev.close)) : null,
      prev_day_range: prev ? pts(ph, pl) : null,
      inside_day: prev ? h <= ph && l >= pl : null,
      outside_day: prev ? h >= ph && l <= pl : null,
      break_prev_day_high: prev ? h > ph : null,
      break_prev_day_low: prev ? l < pl : null,
      uup_open: c.uupOpen === null ? null : round2(c.uupOpen),
      uup_high: c.uupHigh === null ? null : round2(c.uupHigh),
      uup_low: c.uupLow === null ? null : round2(c.uupLow),
      uup_close: c.uupClose === null ? null : round2(c.uupClose),
      uup_volume: c.uupVolume,
      volume_source: VOLUME_SOURCE,
      week_id: wid,
      month_id: mid,
      w_close: wk.w_close,
      w_range: wk.w_range,
      w_range_bucket: wk.w_range_bucket,
      w_daily_match: dClose === wk.w_close,
      wh: wk.wh,
      wl: wk.wl,
      m_close: mo.m_close,
      m_d_match: dClose === mo.m_close,
      m_w_match: wk.w_close === mo.m_close,
      ...tags,
      source_symbol: SOURCE_SYMBOL,
      source_provider: SOURCE_PROVIDER,
    });
  }

  // Weekly bullish/bearish week counts onto months (weeks grouped by month_id).
  for (const m of monthly) {
    const wks = weekly.filter((w) => w.month_id === m.month_id);
    m.weekly_bullish_count = wks.filter((w) => w.w_close === "bullish").length;
    m.weekly_bearish_count = wks.filter((w) => w.w_close === "bearish").length;
  }

  return { daily, weekly, monthly };
}

// Project a V2 daily row to the V1 daily table shape.
export function toDailyV1(r: DailyV2Row) {
  return {
    full_date: r.full_date,
    year: r.year,
    month: r.month,
    day: r.day,
    date: r.date,
    d_range: r.d_range,
    d_close: r.d_close,
    daily_profile: r.daily_profile,
    w_close: r.w_close,
    w_range: r.w_range,
    w_daily_match: r.w_daily_match,
    wh: r.wh,
    wl: r.wl,
    m_close: r.m_close,
    m_d_match: r.m_d_match,
    m_w_match: r.m_w_match,
    event_week: r.event_week,
    cpi_week: r.cpi_week,
    nfp_week: r.nfp_week,
    cpi_release_date_est: r.cpi_release_date_est,
    nfp_release_date_est: r.nfp_release_date_est,
    calendar_source: r.calendar_source,
    source_symbol: r.source_symbol,
    source_provider: r.source_provider,
  };
}
