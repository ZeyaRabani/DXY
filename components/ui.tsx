import type { ReactNode } from "react";
import { biasTone } from "@/lib/format";

export function Panel({
  children,
  className = "",
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-border bg-panel ${className}`}
    >
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0 text-xs text-muted">{right}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel-2 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function BiasBadge({ value }: { value: unknown }) {
  const tone = biasTone(value);
  const label = String(value ?? "—");
  const cls =
    tone === "bull"
      ? "bg-bull/15 text-bull border-bull/30"
      : tone === "bear"
        ? "bg-bear/15 text-bear border-bear/30"
        : "bg-panel-2 text-muted border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {label}
    </span>
  );
}

export function DistBar({
  bullish,
  bearish,
}: {
  bullish: number;
  bearish: number;
}) {
  const total = bullish + bearish;
  const bullPct = total ? (bullish / total) * 100 : 0;
  const bearPct = total ? (bearish / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel-2">
        <div className="bg-bull" style={{ width: `${bullPct}%` }} />
        <div className="bg-bear" style={{ width: `${bearPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted tabular-nums">
        <span className="text-bull">{bullish} bull · {bullPct.toFixed(1)}%</span>
        <span className="text-bear">{bearPct.toFixed(1)}% · {bearish} bear</span>
      </div>
    </div>
  );
}

export function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}
