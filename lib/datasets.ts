// Central registry of datasets, tables, and queryable field metadata.
// Shared by the query engine, the AI parser, and the UI so everything stays in sync.

export type FieldType = "enum" | "number" | "bool" | "date" | "text";

export interface FieldMeta {
  field: string;
  label: string;
  type: FieldType;
  // For enum fields: the canonical allowed values.
  values?: string[];
  // Whether this field is a sensible "target" for distribution analysis.
  targetable?: boolean;
  // Whether to surface this field as a filter control in the data UI.
  filterable?: boolean;
}

export type DatasetId = "daily" | "weekly" | "monthly";
export type SourceId = "v1_daily" | "daily" | "weekly" | "monthly";

export interface DatasetMeta {
  id: SourceId;
  table: string;
  primaryKey: string;
  dateField: string;
  label: string;
  fields: FieldMeta[];
}

const BIAS = ["bullish", "bearish"];
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const EVENT_TYPES = ["normal", "cpi", "nfp", "both"];

export const DATASETS: Record<SourceId, DatasetMeta> = {
  v1_daily: {
    id: "v1_daily",
    table: "dxy_daily_v1",
    primaryKey: "full_date",
    dateField: "full_date",
    label: "V1 Daily",
    fields: [
      { field: "full_date", label: "Date", type: "date", filterable: true },
      { field: "year", label: "Year", type: "number", filterable: true },
      { field: "month", label: "Month", type: "text", filterable: true },
      { field: "day", label: "Weekday", type: "enum", values: WEEKDAYS, filterable: true },
      { field: "d_close", label: "Daily close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "d_range", label: "Daily range (pts)", type: "number", filterable: true },
      { field: "w_close", label: "Weekly close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "w_range", label: "Weekly range (pts)", type: "number", filterable: true },
      { field: "wh", label: "Weekly high day", type: "enum", values: WEEKDAYS, filterable: true },
      { field: "wl", label: "Weekly low day", type: "enum", values: WEEKDAYS, filterable: true },
      { field: "m_close", label: "Monthly close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "event_week", label: "Event week", type: "bool", filterable: true },
      { field: "cpi_week", label: "CPI week", type: "bool", filterable: true },
      { field: "nfp_week", label: "NFP week", type: "bool", filterable: true },
    ],
  },
  daily: {
    id: "daily",
    table: "dxy_daily_v2",
    primaryKey: "full_date",
    dateField: "full_date",
    label: "Daily",
    fields: [
      { field: "full_date", label: "Date", type: "date", filterable: true },
      { field: "year", label: "Year", type: "number", filterable: true },
      { field: "month", label: "Month", type: "text", filterable: true },
      { field: "quarter", label: "Quarter", type: "number", filterable: true },
      { field: "day", label: "Weekday", type: "enum", values: WEEKDAYS, filterable: true },
      { field: "d_close", label: "Daily close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "d_range", label: "Daily range (pts)", type: "number", filterable: true },
      { field: "d_range_bucket", label: "Daily range bucket", type: "text", filterable: true },
      { field: "close_position_pct", label: "Close position %", type: "number", filterable: true },
      { field: "prev_day_close", label: "Previous day close", type: "enum", values: BIAS, filterable: true },
      { field: "inside_day", label: "Inside day", type: "bool", filterable: true },
      { field: "outside_day", label: "Outside day", type: "bool", filterable: true },
      { field: "break_prev_day_high", label: "Broke prev-day high", type: "bool", filterable: true },
      { field: "break_prev_day_low", label: "Broke prev-day low", type: "bool", filterable: true },
      { field: "w_close", label: "Weekly close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "wh", label: "Weekly high day", type: "enum", values: WEEKDAYS, filterable: true },
      { field: "wl", label: "Weekly low day", type: "enum", values: WEEKDAYS, filterable: true },
      { field: "m_close", label: "Monthly close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "event_type", label: "Event type", type: "enum", values: EVENT_TYPES, filterable: true },
      { field: "event_week", label: "Event week", type: "bool", filterable: true },
      { field: "cpi_week", label: "CPI week", type: "bool", filterable: true },
      { field: "nfp_week", label: "NFP week", type: "bool", filterable: true },
      { field: "uup_volume", label: "UUP volume (proxy)", type: "number", filterable: true },
    ],
  },
  weekly: {
    id: "weekly",
    table: "dxy_weekly_v2",
    primaryKey: "week_id",
    dateField: "week_start",
    label: "Weekly",
    fields: [
      { field: "week_start", label: "Week start", type: "date", filterable: true },
      { field: "iso_year", label: "ISO year", type: "number", filterable: true },
      { field: "iso_week", label: "ISO week", type: "number", filterable: true },
      { field: "w_close", label: "Weekly close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "wh", label: "Weekly high day", type: "enum", values: WEEKDAYS, targetable: true, filterable: true },
      { field: "wl", label: "Weekly low day", type: "enum", values: WEEKDAYS, targetable: true, filterable: true },
      { field: "w_range", label: "Weekly range (pts)", type: "number", filterable: true },
      { field: "w_range_bucket", label: "Weekly range bucket", type: "text", filterable: true },
      { field: "w_close_position_pct", label: "Close position %", type: "number", filterable: true },
      { field: "daily_bullish_count", label: "Bullish days", type: "number", filterable: true },
      { field: "daily_bearish_count", label: "Bearish days", type: "number", filterable: true },
      { field: "trading_days", label: "Trading days", type: "number", filterable: true },
      { field: "prev_week_close", label: "Previous week close", type: "enum", values: BIAS, filterable: true },
      { field: "m_close", label: "Monthly close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "event_type", label: "Event type", type: "enum", values: EVENT_TYPES, filterable: true },
      { field: "event_week", label: "Event week", type: "bool", filterable: true },
      { field: "cpi_week", label: "CPI week", type: "bool", filterable: true },
      { field: "nfp_week", label: "NFP week", type: "bool", filterable: true },
      { field: "uup_volume_avg", label: "UUP avg volume (proxy)", type: "number", filterable: true },
    ],
  },
  monthly: {
    id: "monthly",
    table: "dxy_monthly_v2",
    primaryKey: "month_id",
    dateField: "month_start",
    label: "Monthly",
    fields: [
      { field: "month_start", label: "Month start", type: "date", filterable: true },
      { field: "year", label: "Year", type: "number", filterable: true },
      { field: "month", label: "Month", type: "text", filterable: true },
      { field: "month_number", label: "Month number", type: "number", filterable: true },
      { field: "m_close", label: "Monthly close", type: "enum", values: BIAS, targetable: true, filterable: true },
      { field: "m_range", label: "Monthly range (pts)", type: "number", filterable: true },
      { field: "m_range_bucket", label: "Monthly range bucket", type: "text", filterable: true },
      { field: "weekly_bullish_count", label: "Bullish weeks", type: "number", filterable: true },
      { field: "weekly_bearish_count", label: "Bearish weeks", type: "number", filterable: true },
      { field: "trading_days", label: "Trading days", type: "number", filterable: true },
      { field: "prev_month_close", label: "Previous month close", type: "enum", values: BIAS, filterable: true },
      { field: "uup_volume_avg", label: "UUP avg volume (proxy)", type: "number", filterable: true },
    ],
  },
};

export const V2_DATASETS: DatasetId[] = ["daily", "weekly", "monthly"];

export function getDataset(id: SourceId): DatasetMeta {
  return DATASETS[id];
}

export function getField(id: SourceId, field: string): FieldMeta | undefined {
  return DATASETS[id].fields.find((f) => f.field === field);
}

export function isValidField(id: SourceId, field: string): boolean {
  return DATASETS[id].fields.some((f) => f.field === field);
}

export const WEEKDAY_LIST = WEEKDAYS;
export const BIAS_LIST = BIAS;
export const EVENT_TYPE_LIST = EVENT_TYPES;
