// Column definitions for importing the handoff CSVs into Supabase.
// Each column is [dbColumn, type, csvHeader?]. csvHeader defaults to dbColumn.

export type ColType = "date" | "int" | "numeric" | "bigint" | "bool" | "text";
export type ColDef = [string, ColType, string?];

export interface TableDef {
  table: string;
  primaryKey: string;
  csv: string;
  columns: ColDef[];
}

const dailyV1: TableDef = {
  table: "dxy_daily_v1",
  primaryKey: "full_date",
  csv: "data/v1/dxy_daily_v1.csv",
  columns: [
    ["full_date", "date"],
    ["year", "int"],
    ["month", "text"],
    ["day", "text"],
    ["date", "int"],
    ["d_range", "int", "D range"],
    ["d_close", "text", "D close"],
    ["daily_profile", "text", "daily profile"],
    ["w_close", "text", "W close"],
    ["w_range", "int", "W range"],
    ["w_daily_match", "bool", "W&Daily match"],
    ["wh", "text", "WH"],
    ["wl", "text", "WL"],
    ["m_close", "text", "M Close"],
    ["m_d_match", "bool", "M & D match"],
    ["m_w_match", "bool", "M and W match"],
    ["event_week", "bool"],
    ["cpi_week", "bool"],
    ["nfp_week", "bool"],
    ["cpi_release_date_est", "date"],
    ["nfp_release_date_est", "date"],
    ["calendar_source", "text"],
  ],
};

const dailyV2: TableDef = {
  table: "dxy_daily_v2",
  primaryKey: "full_date",
  csv: "data/v2/dxy_daily_v2.csv",
  columns: [
    ["full_date", "date"],
    ["year", "int"],
    ["month", "text"],
    ["month_number", "int"],
    ["day", "text"],
    ["date", "int"],
    ["day_of_month", "int"],
    ["week_of_month", "int"],
    ["quarter", "int"],
    ["d_open", "numeric"],
    ["d_high", "numeric"],
    ["d_low", "numeric"],
    ["d_close_price", "numeric"],
    ["d_range", "int"],
    ["d_range_bucket", "text"],
    ["d_close", "text"],
    ["body_points", "int"],
    ["upper_wick_points", "int"],
    ["lower_wick_points", "int"],
    ["body_pct_of_range", "numeric"],
    ["close_position_pct", "numeric"],
    ["daily_profile", "text"],
    ["prev_day_close", "text"],
    ["prev_day_range", "int"],
    ["inside_day", "bool"],
    ["outside_day", "bool"],
    ["break_prev_day_high", "bool"],
    ["break_prev_day_low", "bool"],
    ["uup_open", "numeric"],
    ["uup_high", "numeric"],
    ["uup_low", "numeric"],
    ["uup_close", "numeric"],
    ["uup_volume", "bigint"],
    ["volume_source", "text"],
    ["week_id", "text"],
    ["month_id", "text"],
    ["w_close", "text"],
    ["w_range", "int"],
    ["w_range_bucket", "text"],
    ["w_daily_match", "bool"],
    ["wh", "text"],
    ["wl", "text"],
    ["m_close", "text"],
    ["m_d_match", "bool"],
    ["m_w_match", "bool"],
    ["event_type", "text"],
    ["event_week", "bool"],
    ["cpi_week", "bool"],
    ["nfp_week", "bool"],
    ["cpi_release_date_est", "date"],
    ["nfp_release_date_est", "date"],
    ["calendar_source", "text"],
    ["source_symbol", "text"],
    ["source_provider", "text"],
  ],
};

const weeklyV2: TableDef = {
  table: "dxy_weekly_v2",
  primaryKey: "week_id",
  csv: "data/v2/dxy_weekly_v2.csv",
  columns: [
    ["week_id", "text"],
    ["week_start", "date"],
    ["week_end", "date"],
    ["iso_year", "int"],
    ["iso_week", "int"],
    ["w_open", "numeric"],
    ["w_high", "numeric"],
    ["w_low", "numeric"],
    ["w_close_price", "numeric"],
    ["w_range", "int"],
    ["w_range_bucket", "text"],
    ["w_close", "text"],
    ["wh", "text"],
    ["wl", "text"],
    ["w_body_points", "int"],
    ["w_upper_wick_points", "int"],
    ["w_lower_wick_points", "int"],
    ["w_close_position_pct", "numeric"],
    ["daily_bullish_count", "int"],
    ["daily_bearish_count", "int"],
    ["trading_days", "int"],
    ["uup_volume_sum", "bigint"],
    ["uup_volume_avg", "bigint"],
    ["prev_week_close", "text"],
    ["prev_week_range", "int"],
    ["prev_week_range_bucket", "text"],
    ["event_type", "text"],
    ["event_week", "bool"],
    ["cpi_week", "bool"],
    ["nfp_week", "bool"],
    ["cpi_release_date_est", "date"],
    ["nfp_release_date_est", "date"],
    ["calendar_source", "text"],
    ["month_id", "text"],
    ["m_close", "text"],
    ["m_range", "int"],
    ["m_range_bucket", "text"],
  ],
};

const monthlyV2: TableDef = {
  table: "dxy_monthly_v2",
  primaryKey: "month_id",
  csv: "data/v2/dxy_monthly_v2.csv",
  columns: [
    ["month_id", "text"],
    ["month_start", "date"],
    ["month_end", "date"],
    ["year", "int"],
    ["month", "text"],
    ["month_number", "int"],
    ["m_open", "numeric"],
    ["m_high", "numeric"],
    ["m_low", "numeric"],
    ["m_close_price", "numeric"],
    ["m_range", "int"],
    ["m_range_bucket", "text"],
    ["m_close", "text"],
    ["weekly_bullish_count", "int"],
    ["weekly_bearish_count", "int"],
    ["trading_days", "int"],
    ["uup_volume_sum", "bigint"],
    ["uup_volume_avg", "bigint"],
    ["prev_month_close", "text"],
    ["prev_month_range", "int"],
    ["prev_month_range_bucket", "text"],
  ],
};

export const TABLE_DEFS: TableDef[] = [dailyV1, dailyV2, weeklyV2, monthlyV2];

export function coerce(raw: string | undefined, type: ColType): unknown {
  if (raw === undefined) return null;
  const v = raw.trim();
  if (v === "") return null;
  switch (type) {
    case "int":
    case "bigint": {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    }
    case "numeric": {
      const n = Number.parseFloat(v);
      return Number.isFinite(n) ? n : null;
    }
    case "bool": {
      const low = v.toLowerCase();
      if (["1", "true", "t", "yes", "y"].includes(low)) return true;
      if (["0", "false", "f", "no", "n"].includes(low)) return false;
      return null;
    }
    case "date":
    case "text":
    default:
      return v;
  }
}
