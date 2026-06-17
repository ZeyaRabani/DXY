// Small pure formatting helpers shared across server and client components.

export function fmtDate(value: unknown): string {
  if (!value) return "—";
  const d = typeof value === "string" ? value.slice(0, 10) : String(value);
  return d;
}

export function fmtNumber(value: unknown, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtInt(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return Math.round(n).toLocaleString("en-US");
}

export function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pctStr(count: number, total: number): string {
  if (!total) return "0.00%";
  return `${((count / total) * 100).toFixed(2)}%`;
}

export function biasTone(value: unknown): "bull" | "bear" | "neutral" {
  const v = String(value ?? "").toLowerCase();
  if (v === "bullish") return "bull";
  if (v === "bearish") return "bear";
  return "neutral";
}
