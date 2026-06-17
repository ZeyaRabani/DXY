import Link from "next/link";
import { Panel, Stat, BiasBadge, DistBar } from "@/components/ui";
import { latestRow, rowCount } from "@/lib/query";
import { overallBias } from "@/lib/stats";
import { fmtDate, fmtInt, titleCase } from "@/lib/format";

export const revalidate = 300;

export default async function V1Dashboard() {
  const [latest, count, dDist, wDist, mDist] = await Promise.all([
    latestRow("v1_daily"),
    rowCount("v1_daily"),
    overallBias("v1_daily", "d_close"),
    overallBias("v1_daily", "w_close"),
    overallBias("v1_daily", "m_close"),
  ]);

  const row = latest ?? {};
  const eventFlags = [
    ["Event week", row.event_week],
    ["CPI week", row.cpi_week],
    ["NFP week", row.nfp_week],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">V1 — Original Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Latest DXY daily candle, current close bias across timeframes, and
            historical bias distribution.
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>Latest update</div>
          <div className="text-sm font-medium text-foreground">{fmtDate(row.full_date)}</div>
          <div>{fmtInt(count)} daily rows</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Latest date" value={fmtDate(row.full_date)} hint={titleCase(String(row.day ?? ""))} />
        <Stat label="Daily close" value={<BiasBadge value={row.d_close} />} hint={`Range ${fmtInt(row.d_range)} pts`} />
        <Stat label="Weekly close" value={<BiasBadge value={row.w_close} />} hint={`Range ${fmtInt(row.w_range)} pts`} />
        <Stat label="Monthly close" value={<BiasBadge value={row.m_close} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Daily close bias" subtitle="All history">
          <DistBar bullish={dDist.bullish} bearish={dDist.bearish} />
        </Panel>
        <Panel title="Weekly close bias" subtitle="Counted per trading day">
          <DistBar bullish={wDist.bullish} bearish={wDist.bearish} />
        </Panel>
        <Panel title="Monthly close bias" subtitle="Counted per trading day">
          <DistBar bullish={mDist.bullish} bearish={mDist.bearish} />
        </Panel>
      </div>

      <Panel title="Latest daily row detail">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Weekday" value={titleCase(String(row.day ?? "—"))} />
          <Field label="Weekly high day" value={titleCase(String(row.wh ?? "—"))} />
          <Field label="Weekly low day" value={titleCase(String(row.wl ?? "—"))} />
          <Field label="Daily range" value={`${fmtInt(row.d_range)} pts`} />
          <Field label="Weekly range" value={`${fmtInt(row.w_range)} pts`} />
          {eventFlags.map(([label, val]) => (
            <Field key={label} label={label} value={val ? "Yes" : "No"} />
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/v1/data" className="rounded-md border border-border bg-panel px-3 py-2 hover:bg-panel-2">
          Browse & filter the full history →
        </Link>
        <Link href="/v1/patterns" className="rounded-md border border-border bg-panel px-3 py-2 hover:bg-panel-2">
          See pattern stats →
        </Link>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}
