import Link from "next/link";
import { Panel, Stat, BiasBadge, DistBar } from "@/components/ui";
import { latestRow, rowCount } from "@/lib/query";
import { overallBias } from "@/lib/stats";
import { fmtDate, fmtInt, fmtNumber, titleCase } from "@/lib/format";

export const revalidate = 300;

export default async function V2Dashboard() {
  const [daily, weekly, monthly, dCount, wCount, mCount, dBias, wBias, mBias] =
    await Promise.all([
      latestRow("daily"),
      latestRow("weekly"),
      latestRow("monthly"),
      rowCount("daily"),
      rowCount("weekly"),
      rowCount("monthly"),
      overallBias("daily", "d_close"),
      overallBias("weekly", "w_close"),
      overallBias("monthly", "m_close"),
    ]);

  const d = daily ?? {};
  const w = weekly ?? {};
  const m = monthly ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">V2 — Expanded Research</h1>
          <p className="mt-1 text-sm text-muted">
            Separate daily, weekly and monthly datasets with OHLC, close bias and
            UUP volume proxy. Latest completed candle for each timeframe.
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>Latest daily candle</div>
          <div className="text-sm font-medium text-foreground">{fmtDate(d.full_date)}</div>
        </div>
      </div>

      {/* Daily */}
      <Panel
        title="Latest daily candle"
        subtitle={`${fmtDate(d.full_date)} · ${titleCase(String(d.day ?? ""))}`}
        right={<BiasBadge value={d.d_close} />}
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Open" value={fmtNumber(d.d_open)} />
          <Stat label="High" value={fmtNumber(d.d_high)} />
          <Stat label="Low" value={fmtNumber(d.d_low)} />
          <Stat label="Close" value={fmtNumber(d.d_close_price)} />
          <Stat label="Range" value={`${fmtInt(d.d_range)} pts`} hint={`Close pos ${fmtNumber(d.close_position_pct, 1)}%`} />
          <Stat label="UUP volume" value={fmtInt(d.uup_volume)} hint="ETF proxy" />
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs text-muted">Daily close bias — all history ({fmtInt(dCount)} days)</div>
          <DistBar bullish={dBias.bullish} bearish={dBias.bearish} />
        </div>
      </Panel>

      {/* Weekly */}
      <Panel
        title="Latest weekly candle"
        subtitle={`Week of ${fmtDate(w.week_start)}`}
        right={<BiasBadge value={w.w_close} />}
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Open" value={fmtNumber(w.w_open)} />
          <Stat label="Close" value={fmtNumber(w.w_close_price)} />
          <Stat label="Range" value={`${fmtInt(w.w_range)} pts`} />
          <Stat label="High day" value={titleCase(String(w.wh ?? "—"))} />
          <Stat label="Low day" value={titleCase(String(w.wl ?? "—"))} />
          <Stat label="UUP avg vol" value={fmtInt(w.uup_volume_avg)} hint="ETF proxy" />
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs text-muted">Weekly close bias — all history ({fmtInt(wCount)} weeks)</div>
          <DistBar bullish={wBias.bullish} bearish={wBias.bearish} />
        </div>
      </Panel>

      {/* Monthly */}
      <Panel
        title="Latest monthly candle"
        subtitle={`Month of ${fmtDate(m.month_start)}`}
        right={<BiasBadge value={m.m_close} />}
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Open" value={fmtNumber(m.m_open)} />
          <Stat label="Close" value={fmtNumber(m.m_close_price)} />
          <Stat label="Range" value={`${fmtInt(m.m_range)} pts`} />
          <Stat label="Bull weeks" value={fmtInt(m.weekly_bullish_count)} />
          <Stat label="Bear weeks" value={fmtInt(m.weekly_bearish_count)} />
          <Stat label="UUP avg vol" value={fmtInt(m.uup_volume_avg)} hint="ETF proxy" />
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs text-muted">Monthly close bias — all history ({fmtInt(mCount)} months)</div>
          <DistBar bullish={mBias.bullish} bearish={mBias.bearish} />
        </div>
      </Panel>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/v2/data" className="rounded-md border border-border bg-panel px-3 py-2 hover:bg-panel-2">
          Explore daily / weekly / monthly data →
        </Link>
        <Link href="/v2/patterns" className="rounded-md border border-border bg-panel px-3 py-2 hover:bg-panel-2">
          Weekly pattern studies →
        </Link>
        <Link href="/v2/ai" className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-accent hover:bg-accent/20">
          Ask the AI assistant →
        </Link>
      </div>
    </div>
  );
}
