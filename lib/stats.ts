import "server-only";
import { fetchAll } from "./query";
import { WEEKDAY_LIST, type SourceId } from "./datasets";

export interface BiasCount {
  key: string;
  bullish: number;
  bearish: number;
  total: number;
  bullPct: number;
  bearPct: number;
}

function tally(rows: Array<Record<string, unknown>>, keyField: string, biasField: string): BiasCount[] {
  const map = new Map<string, { bullish: number; bearish: number }>();
  for (const r of rows) {
    const key = String(r[keyField] ?? "—");
    const bias = String(r[biasField] ?? "").toLowerCase();
    if (bias !== "bullish" && bias !== "bearish") continue;
    const cur = map.get(key) ?? { bullish: 0, bearish: 0 };
    if (bias === "bullish") cur.bullish += 1;
    else cur.bearish += 1;
    map.set(key, cur);
  }
  return [...map.entries()].map(([key, v]) => {
    const total = v.bullish + v.bearish;
    return {
      key,
      bullish: v.bullish,
      bearish: v.bearish,
      total,
      bullPct: total ? (v.bullish / total) * 100 : 0,
      bearPct: total ? (v.bearish / total) * 100 : 0,
    };
  });
}

function orderByWeekday(rows: BiasCount[]): BiasCount[] {
  const order = new Map(WEEKDAY_LIST.map((d, i) => [d, i]));
  return [...rows].sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
}

// Overall bias split for a target field across the whole dataset.
export async function overallBias(dataset: SourceId, biasField: string): Promise<BiasCount> {
  const rows = await fetchAll(dataset, [biasField]);
  const [all] = tally(
    rows.map((r) => ({ ...r, _all: "all" })),
    "_all",
    biasField,
  );
  return all ?? { key: "all", bullish: 0, bearish: 0, total: 0, bullPct: 0, bearPct: 0 };
}

// Bias by weekday (which weekday the daily candle closed bull/bear).
export async function biasByWeekday(
  dataset: SourceId,
  dayField: string,
  biasField: string,
): Promise<BiasCount[]> {
  const rows = await fetchAll(dataset, [dayField, biasField]);
  return orderByWeekday(tally(rows, dayField, biasField));
}

// Generic "bias grouped by an enum field" (e.g. wh -> w_close).
export async function biasByField(
  dataset: SourceId,
  keyField: string,
  biasField: string,
  weekdayOrder = false,
): Promise<BiasCount[]> {
  const rows = await fetchAll(dataset, [keyField, biasField]);
  const out = tally(rows, keyField, biasField);
  return weekdayOrder ? orderByWeekday(out) : out.sort((a, b) => b.total - a.total);
}

// CPI / NFP / normal week comparison for a bias field (weekly dataset).
export async function eventWeekComparison(
  dataset: SourceId,
  biasField: string,
): Promise<BiasCount[]> {
  const rows = await fetchAll(dataset, ["event_type", biasField]);
  const groups: Record<string, string> = {
    normal: "Normal week",
    cpi: "CPI week",
    nfp: "NFP week",
    both: "CPI + NFP week",
  };
  const tallied = tally(rows, "event_type", biasField);
  const labelled = tallied
    .filter((t) => groups[t.key])
    .map((t) => ({ ...t, key: groups[t.key] }));
  const order = ["Normal week", "CPI week", "NFP week", "CPI + NFP week"];
  return labelled.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
