import { Panel } from "@/components/ui";
import PatternTable from "@/components/PatternTable";
import { biasByField, biasByWeekday, eventWeekComparison } from "@/lib/stats";

export const revalidate = 300;
export const metadata = { title: "V2 Patterns — DXY Research" };

export default async function V2Patterns() {
  const [byHigh, byLow, byPrevWeek, eventCmp, dailyByWeekday, monthlyByPrev] =
    await Promise.all([
      biasByField("weekly", "wh", "w_close", true),
      biasByField("weekly", "wl", "w_close", true),
      biasByField("weekly", "prev_week_close", "w_close"),
      eventWeekComparison("weekly", "w_close"),
      biasByWeekday("daily", "day", "d_close"),
      biasByField("monthly", "prev_month_close", "m_close"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">V2 — Pattern studies</h1>
        <p className="mt-1 text-sm text-muted">
          Weekly-focused frequency studies plus a CPI / NFP / normal-week
          comparison. All percentages are historical frequencies, not forecasts.
        </p>
      </div>

      <Panel
        title="CPI / NFP / normal week comparison"
        subtitle="How the weekly candle closed by event type"
      >
        <PatternTable rows={eventCmp} keyLabel="Week type" emphasiseKey={false} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Weekly close vs weekly-high day" subtitle="Day the week's high formed">
          <PatternTable rows={byHigh} keyLabel="High day" />
        </Panel>
        <Panel title="Weekly close vs weekly-low day" subtitle="Day the week's low formed">
          <PatternTable rows={byLow} keyLabel="Low day" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Weekly close vs previous-week close" subtitle="Follow-through / reversal tendency">
          <PatternTable rows={byPrevWeek} keyLabel="Prev week" />
        </Panel>
        <Panel title="Monthly close vs previous-month close" subtitle="Month-over-month follow-through">
          <PatternTable rows={monthlyByPrev} keyLabel="Prev month" />
        </Panel>
      </div>

      <Panel title="Daily close bias by weekday" subtitle="V2 daily dataset">
        <PatternTable rows={dailyByWeekday} keyLabel="Weekday" />
      </Panel>
    </div>
  );
}
