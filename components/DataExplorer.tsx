"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DATASETS, type FieldMeta, type SourceId } from "@/lib/datasets";
import type { Filter } from "@/lib/plan";
import { biasTone, fmtDate, fmtInt, fmtNumber, titleCase } from "@/lib/format";

type NumRange = { min?: string; max?: string };
type FilterState = Record<string, string | NumRange>;

interface Props {
  dataset: SourceId;
}

interface ApiResult {
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

function buildFilters(meta: typeof DATASETS[SourceId], state: FilterState): Filter[] {
  const filters: Filter[] = [];
  for (const f of meta.fields) {
    const v = state[f.field];
    if (v === undefined) continue;
    if (f.type === "number" || f.type === "date") {
      const r = v as NumRange;
      const min = r.min?.trim();
      const max = r.max?.trim();
      const cast = (x: string) => (f.type === "number" ? Number(x) : x);
      if (min && max) filters.push({ field: f.field, op: "between", value: [cast(min), cast(max)] });
      else if (min) filters.push({ field: f.field, op: "gte", value: cast(min) });
      else if (max) filters.push({ field: f.field, op: "lte", value: cast(max) });
    } else {
      const s = (v as string).trim();
      if (s !== "") filters.push({ field: f.field, op: "eq", value: s });
    }
  }
  return filters;
}

function Cell({ field, value }: { field: FieldMeta; value: unknown }) {
  if (field.type === "enum" && field.values?.includes("bullish")) {
    const tone = biasTone(value);
    const cls = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-muted";
    return <span className={`capitalize ${cls}`}>{String(value ?? "—")}</span>;
  }
  if (field.type === "date") return <span className="tabular-nums">{fmtDate(value)}</span>;
  if (field.type === "bool") return <span>{value ? "Yes" : value === false ? "No" : "—"}</span>;
  if (field.type === "number") {
    const isInt = /range|count|year|week|quarter|volume|number|days/.test(field.field);
    return <span className="tabular-nums">{isInt ? fmtInt(value) : fmtNumber(value)}</span>;
  }
  if (field.type === "enum") return <span className="capitalize">{String(value ?? "—")}</span>;
  return <span>{value === null || value === undefined || value === "" ? "—" : String(value)}</span>;
}

export default function DataExplorer({ dataset }: Props) {
  const meta = DATASETS[dataset];
  const [state, setState] = useState<FilterState>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => buildFilters(meta, state), [meta, state]);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dataset,
            filters,
            page: p,
            pageSize,
            orderBy: meta.dateField,
            ascending: false,
          }),
        });
        const json = (await res.json()) as ApiResult;
        if (!res.ok) throw new Error(json.error ?? "Query failed");
        setData(json);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [dataset, filters, pageSize, meta.dateField],
  );

  // Reload from page 1 when the dataset or page size changes. The fetch updates
  // state asynchronously; the synchronous resets here are intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPage(1);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, pageSize]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const applyFilters = () => {
    setPage(1);
    void load(1);
  };
  const resetFilters = () => {
    setState({});
  };
  const goTo = (p: number) => {
    setPage(p);
    void load(p);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filterFields = meta.fields.filter((f) => f.filterable);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-panel p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filterFields.map((f) => (
            <FilterControl
              key={f.field}
              field={f}
              value={state[f.field]}
              onChange={(v) => setState((s) => ({ ...s, [f.field]: v }))}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={applyFilters}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Apply filters
          </button>
          <button
            onClick={resetFilters}
            className="rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm hover:bg-panel"
          >
            Reset
          </button>
          <span className="ml-auto text-xs text-muted">
            {data ? `${fmtInt(data.total)} matching rows` : "—"}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-sm text-bear">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border scroll-thin">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-panel-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              {meta.fields.map((f) => (
                <th key={f.field} className="whitespace-nowrap px-3 py-2 font-medium">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((row, i) => (
              <tr key={i} className="border-t border-border hover:bg-panel/60">
                {meta.fields.map((f) => (
                  <td key={f.field} className="whitespace-nowrap px-3 py-1.5">
                    <Cell field={f} value={row[f.field]} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && data?.rows.length === 0 && (
              <tr>
                <td colSpan={meta.fields.length} className="px-3 py-6 text-center text-muted">
                  No rows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-xs text-muted">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-md border border-border bg-panel px-2 py-1 text-foreground"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => goTo(page - 1)}
            className="rounded-md border border-border bg-panel px-2.5 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-muted">
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => goTo(page + 1)}
            className="rounded-md border border-border bg-panel px-2.5 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterControl({
  field,
  value,
  onChange,
}: {
  field: FieldMeta;
  value: string | NumRange | undefined;
  onChange: (v: string | NumRange) => void;
}) {
  const base =
    "rounded-md border border-border bg-panel-2 px-2 py-1 text-sm text-foreground";
  if (field.type === "enum") {
    return (
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted">{field.label}</span>
        <select className={base} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Any</option>
          {field.values?.map((v) => (
            <option key={v} value={v}>{titleCase(v)}</option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === "bool") {
    return (
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted">{field.label}</span>
        <select className={base} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    );
  }
  if (field.type === "number" || field.type === "date") {
    const r = (value as NumRange) ?? {};
    const t = field.type === "date" ? "date" : "number";
    return (
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted">{field.label}</span>
        <div className="flex gap-1">
          <input
            type={t}
            placeholder="min"
            value={r.min ?? ""}
            onChange={(e) => onChange({ ...r, min: e.target.value })}
            className={`${base} w-full`}
          />
          <input
            type={t}
            placeholder="max"
            value={r.max ?? ""}
            onChange={(e) => onChange({ ...r, max: e.target.value })}
            className={`${base} w-full`}
          />
        </div>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted">{field.label}</span>
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={base}
        placeholder="exact match"
      />
    </label>
  );
}
