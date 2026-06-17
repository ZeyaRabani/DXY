import DataExplorer from "@/components/DataExplorer";

export const metadata = { title: "V1 Data — DXY Research" };

export default function V1DataPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">V1 — Historical data</h1>
        <p className="mt-1 text-sm text-muted">
          The full DXY daily history. Filter by date, weekday, daily/weekly/monthly
          close, ranges, and event weeks.
        </p>
      </div>
      <DataExplorer dataset="v1_daily" />
    </div>
  );
}
