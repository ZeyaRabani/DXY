import type { BiasCount } from "@/lib/stats";
import { titleCase } from "@/lib/format";

export default function PatternTable({
  rows,
  keyLabel,
  emphasiseKey = true,
}: {
  rows: BiasCount[];
  keyLabel: string;
  emphasiseKey?: boolean;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted">No data.</p>;
  }
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-2 py-1.5 font-medium">{keyLabel}</th>
            <th className="px-2 py-1.5 text-right font-medium">Bull</th>
            <th className="px-2 py-1.5 text-right font-medium">Bear</th>
            <th className="px-2 py-1.5 text-right font-medium">Total</th>
            <th className="px-2 py-1.5 font-medium">Distribution</th>
            <th className="px-2 py-1.5 text-right font-medium">Lean</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const lean = r.bullPct >= r.bearPct ? "bull" : "bear";
            const leanPct = Math.max(r.bullPct, r.bearPct);
            return (
              <tr key={r.key} className="border-t border-border">
                <td className={`px-2 py-2 ${emphasiseKey ? "font-medium" : ""}`}>
                  {emphasiseKey ? titleCase(r.key) : r.key}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-bull">{r.bullish}</td>
                <td className="px-2 py-2 text-right tabular-nums text-bear">{r.bearish}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted">{r.total}</td>
                <td className="px-2 py-2">
                  <div className="flex h-2.5 w-40 overflow-hidden rounded-full bg-panel-2">
                    <div className="bg-bull" style={{ width: `${r.bullPct}%` }} />
                    <div className="bg-bear" style={{ width: `${r.bearPct}%` }} />
                  </div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <span className={lean === "bull" ? "text-bull" : "text-bear"}>
                    {leanPct.toFixed(1)}% {lean}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
