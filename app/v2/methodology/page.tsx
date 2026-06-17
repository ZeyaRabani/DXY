import { Panel } from "@/components/ui";

export const metadata = { title: "V2 Methodology — DXY Research" };

export default function V2Methodology() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">V2 — Methodology & sources</h1>
        <p className="mt-1 text-sm text-muted">How the datasets are built, and how the AI assistant works.</p>
      </div>

      <Panel title="Data sources">
        <ul className="space-y-2 text-sm">
          <li><b>DXY OHLC:</b> Yahoo Finance, symbol <code className="text-accent">DX-Y.NYB</code> (daily). Weekly and monthly candles are aggregated from the daily series.</li>
          <li><b>Volume:</b> the DXY index itself has no real volume, so we use the <b>UUP ETF</b> (Invesco DB US Dollar Index Bullish Fund) volume from Yahoo Finance as a free proxy. It is always labelled <code className="text-accent">UUP ETF proxy</code>.</li>
          <li><b>CPI / NFP event dates:</b> estimated from a recurring release calendar, not official prints. Treat event-week tags as approximate.</li>
          <li><b>Coverage:</b> 1986 to the latest completed New York session.</li>
        </ul>
      </Panel>

      <Panel title="Datasets">
        <ul className="space-y-2 text-sm">
          <li><b>Daily:</b> one row per trading day with OHLC, range, body/wick geometry, close position, inside/outside-day flags, prior-day breaks and event tags.</li>
          <li><b>Weekly:</b> one row per ISO week with OHLC, the weekday the high/low printed, bullish/bearish day counts and the parent month&apos;s close.</li>
          <li><b>Monthly:</b> one row per calendar month with OHLC, range bucket and weekly bullish/bearish counts.</li>
        </ul>
      </Panel>

      <Panel title="How the AI assistant works">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>A deterministic parser turns common trading questions into a structured query plan (dataset, target field, filters).</li>
          <li>If a local LLM is configured (optional, no paid keys), it can convert wording into the same JSON plan — but it is <b>never</b> trusted to compute statistics.</li>
          <li>The plan is validated against a field whitelist and executed as an exact query against the database.</li>
          <li>All counts and percentages are computed in code from the returned rows, then phrased in plain English. The plan, full distribution and sample rows are shown for auditability.</li>
        </ol>
        <p className="mt-3 text-sm text-muted">
          Conversation memory lives only in your browser session and is cleared on
          refresh. Chat history is never stored in the database.
        </p>
      </Panel>

      <Panel title="Updates">
        <p className="text-sm text-muted">
          A scheduled job runs after the New York close (~22:30 UTC). It fetches
          the latest completed DXY and UUP candles from Yahoo Finance, recomputes
          the affected daily, weekly and monthly rows, and records each run.
          Partial current-day candles are never written.
        </p>
      </Panel>
    </div>
  );
}
