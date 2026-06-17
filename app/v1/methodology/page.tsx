import { Panel } from "@/components/ui";

export const metadata = { title: "V1 Methodology — DXY Research" };

export default function V1Methodology() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">V1 — Methodology & sources</h1>
        <p className="mt-1 text-sm text-muted">
          What the numbers mean and where they come from.
        </p>
      </div>

      <Panel title="Data sources">
        <ul className="space-y-2 text-sm">
          <li><b>DXY OHLC:</b> Yahoo Finance, symbol <code className="text-accent">DX-Y.NYB</code>.</li>
          <li><b>Coverage:</b> daily rows from 1986 to the latest completed New York session.</li>
          <li><b>CPI / NFP event dates:</b> estimated from a recurring calendar, not official releases. Treat event-week flags as approximate.</li>
        </ul>
      </Panel>

      <Panel title="Definitions">
        <ul className="space-y-2 text-sm">
          <li><b>Daily close:</b> bullish if the close is above the open, bearish otherwise.</li>
          <li><b>Weekly / monthly close:</b> the bias of the week or month that the day belongs to.</li>
          <li><b>Weekly high / low day:</b> the weekday on which that week&apos;s high or low printed.</li>
          <li><b>Range (pts):</b> high minus low, in index points.</li>
          <li><b>Event week:</b> a week containing an estimated CPI and/or NFP release.</li>
        </ul>
      </Panel>

      <Panel title="How to read the stats">
        <p className="text-sm text-muted">
          All figures are historical frequencies — how often something happened
          in the past. They are descriptive statistics for research and
          education, not forecasts or trading advice. A strong historical lean
          is best treated as one bias filter among many, never a standalone
          signal.
        </p>
      </Panel>

      <Panel title="Updates">
        <p className="text-sm text-muted">
          The dataset refreshes automatically after the New York close (~22:30
          UTC) so the latest completed daily candle is included. Partial
          current-day candles are never written.
        </p>
      </Panel>
    </div>
  );
}
