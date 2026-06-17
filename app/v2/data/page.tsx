import DatasetSwitcher from "@/components/DatasetSwitcher";

export const metadata = { title: "V2 Data — DXY Research" };

export default function V2DataPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">V2 — Data explorer</h1>
        <p className="mt-1 text-sm text-muted">
          Switch between the daily, weekly and monthly datasets and filter on any
          field. Volume columns are the UUP ETF proxy.
        </p>
      </div>
      <DatasetSwitcher />
    </div>
  );
}
