import { Panel } from "@/components/ui";
import PatternTable from "@/components/PatternTable";
import { biasByWeekday, biasByField } from "@/lib/stats";

export const revalidate = 300;
export const metadata = { title: "V1 Patterns — DXY Research" };

export default async function V1Patterns() {
  const [byWeekday, byHighDay, byLowDay] = await Promise.all([
    biasByWeekday("v1_daily", "day", "d_close"),
    biasByField("v1_daily", "wh", "w_close", true),
    biasByField("v1_daily", "wl", "w_close", true),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">V1 — Pattern stats</h1>
        <p className="mt-1 text-sm text-muted">
          Basic historical frequencies. Percentages are how often the candle
          closed bullish vs bearish — descriptive, not predictive.
        </p>
      </div>

      <Panel title="Daily close bias by weekday" subtitle="How DXY closed each weekday across all history">
        <PatternTable rows={byWeekday} keyLabel="Weekday" />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Weekly close vs weekly-high day" subtitle="Day the week's high formed → weekly close">
          <PatternTable rows={byHighDay} keyLabel="High day" />
        </Panel>
        <Panel title="Weekly close vs weekly-low day" subtitle="Day the week's low formed → weekly close">
          <PatternTable rows={byLowDay} keyLabel="Low day" />
        </Panel>
      </div>
    </div>
  );
}
