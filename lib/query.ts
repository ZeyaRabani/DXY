import "server-only";

import { getServerSupabase } from "./supabase";
import {
  DATASETS,
  getField,
  type FieldMeta,
  type SourceId,
} from "./datasets";
import type {
  Filter,
  FilterOp,
  QueryPlan,
  DistributionRow,
  ValidationIssue,
} from "./plan";

export type { Filter, FilterOp, QueryPlan, DistributionRow, ValidationIssue };

const PAGE = 1000;

// Normalises and validates a single filter against the dataset's field whitelist.
// Returns the cleaned filter, or null with an issue pushed onto `issues`.
function cleanFilter(
  dataset: SourceId,
  raw: Filter,
  issues: ValidationIssue[],
): Filter | null {
  const meta = getField(dataset, raw.field);
  if (!meta) {
    issues.push({ field: raw.field, message: `Unknown field for ${dataset}` });
    return null;
  }
  const value = coerceValue(meta, raw.op, raw.value, issues);
  if (value === undefined) return null;
  return { field: raw.field, op: raw.op, value };
}

function coerceScalar(meta: FieldMeta, v: string | number | boolean): string | number | boolean | null {
  switch (meta.type) {
    case "number":
      return typeof v === "number" ? v : Number(v);
    case "bool":
      if (typeof v === "boolean") return v;
      return ["1", "true", "yes", "y"].includes(String(v).toLowerCase());
    case "enum":
      return String(v).toLowerCase();
    default:
      return String(v);
  }
}

function coerceValue(
  meta: FieldMeta,
  op: FilterOp,
  value: Filter["value"],
  issues: ValidationIssue[],
): Filter["value"] | undefined {
  if (op === "between") {
    if (!Array.isArray(value) || value.length !== 2) {
      issues.push({ field: meta.field, message: "between needs [min, max]" });
      return undefined;
    }
    return value.map((v) => coerceScalar(meta, v)) as Array<string | number>;
  }
  if (op === "in") {
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((v) => coerceScalar(meta, v)) as Array<string | number>;
  }
  const scalar = coerceScalar(meta, value as string | number | boolean);
  if (meta.type === "number" && typeof scalar === "number" && Number.isNaN(scalar)) {
    issues.push({ field: meta.field, message: "expected a number" });
    return undefined;
  }
  if (meta.type === "enum" && meta.values && !meta.values.includes(String(scalar))) {
    issues.push({
      field: meta.field,
      message: `expected one of ${meta.values.join(", ")}`,
    });
    return undefined;
  }
  return scalar as Filter["value"];
}

export function validatePlan(plan: QueryPlan): {
  filters: Filter[];
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  if (!DATASETS[plan.dataset]) {
    issues.push({ field: "dataset", message: `Unknown dataset ${plan.dataset}` });
    return { filters: [], issues };
  }
  const filters: Filter[] = [];
  for (const f of plan.filters) {
    const cleaned = cleanFilter(plan.dataset, f, issues);
    if (cleaned) filters.push(cleaned);
  }
  return { filters, issues };
}

// Structural view of the chainable filter methods we use. Applied via a cast so
// the caller's concrete (and very deep) PostgREST builder type is preserved for
// the terminal `.order()`/`.range()` calls without tripping TS2589.
interface Filterable<T> {
  eq(column: string, value: string | number | boolean): T;
  neq(column: string, value: string | number | boolean): T;
  gte(column: string, value: string | number): T;
  lte(column: string, value: string | number): T;
  in(column: string, value: Array<string | number>): T;
}

function applyFilters<T>(query: T, filters: Filter[]): T {
  let cur = query;
  for (const f of filters) {
    const b = cur as Filterable<T>;
    switch (f.op) {
      case "eq":
        cur = b.eq(f.field, f.value as string | number | boolean);
        break;
      case "neq":
        cur = b.neq(f.field, f.value as string | number | boolean);
        break;
      case "gte":
        cur = b.gte(f.field, f.value as string | number);
        break;
      case "lte":
        cur = b.lte(f.field, f.value as string | number);
        break;
      case "between": {
        const [min, max] = f.value as Array<string | number>;
        cur = (b.gte(f.field, min) as Filterable<T>).lte(f.field, max);
        break;
      }
      case "in":
        cur = b.in(f.field, f.value as Array<string | number>);
        break;
    }
  }
  return cur;
}

// Counts the distribution of `targetField` over rows matching `filters`.
// All counting happens here (never in the model) so numbers are exact.
export async function runDistribution(
  dataset: SourceId,
  targetField: string,
  filters: Filter[],
): Promise<{ total: number; distribution: DistributionRow[] }> {
  const supabase = getServerSupabase();
  const table = DATASETS[dataset].table;
  const counts = new Map<string, number>();
  let total = 0;
  let from = 0;
  for (;;) {
    const base = supabase.from(table).select(targetField);
    const { data, error } = await applyFilters(base, filters).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    for (const row of rows) {
      const v = row[targetField];
      const key = v === null || v === undefined ? "null" : String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  const distribution = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
  return { total, distribution };
}

export interface RowsResult {
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}

// Fetches a page of matching rows plus an exact total count.
export async function runRows(
  dataset: SourceId,
  filters: Filter[],
  opts: { columns?: string[]; page?: number; pageSize?: number; orderBy?: string; ascending?: boolean } = {},
): Promise<RowsResult> {
  const supabase = getServerSupabase();
  const meta = DATASETS[dataset];
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, opts.pageSize ?? 50));
  const select = opts.columns?.length ? opts.columns.join(", ") : "*";
  const orderBy = opts.orderBy ?? meta.dateField;
  const ascending = opts.ascending ?? false;
  const fromIdx = (page - 1) * pageSize;

  const base = supabase.from(meta.table).select(select, { count: "exact" });
  const { data, error, count } = await applyFilters(base, filters)
    .order(orderBy, { ascending })
    .range(fromIdx, fromIdx + pageSize - 1);
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []) as unknown as Array<Record<string, unknown>>,
    total: count ?? 0,
    page,
    pageSize,
  };
}

// Convenience: latest row by date for any dataset.
export async function latestRow(dataset: SourceId): Promise<Record<string, unknown> | null> {
  const supabase = getServerSupabase();
  const meta = DATASETS[dataset];
  const { data, error } = await supabase
    .from(meta.table)
    .select("*")
    .order(meta.dateField, { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length ? (data[0] as unknown as Record<string, unknown>) : null;
}

// Fetches every matching row (selected columns only), paging past the 1000-row
// PostgREST cap. Used for client-side pattern aggregation over whole datasets.
export async function fetchAll(
  dataset: SourceId,
  columns: string[],
  filters: Filter[] = [],
): Promise<Array<Record<string, unknown>>> {
  const supabase = getServerSupabase();
  const table = DATASETS[dataset].table;
  const select = columns.join(", ");
  const out: Array<Record<string, unknown>> = [];
  let from = 0;
  for (;;) {
    const base = supabase.from(table).select(select);
    const { data, error } = await applyFilters(base, filters).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function rowCount(dataset: SourceId): Promise<number> {
  const supabase = getServerSupabase();
  const { count, error } = await supabase
    .from(DATASETS[dataset].table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}
