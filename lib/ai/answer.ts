import type { DistributionRow, QueryPlan } from "../plan";
import { getField, type SourceId } from "../datasets";

function unit(dataset: SourceId, plural = true): string {
  const map: Record<string, [string, string]> = {
    weekly: ["week", "weeks"],
    monthly: ["month", "months"],
    daily: ["day", "days"],
    v1_daily: ["day", "days"],
  };
  const [s, p] = map[dataset] ?? ["row", "rows"];
  return plural ? p : s;
}

export function unitLabel(dataset: SourceId): string {
  return unit(dataset, true);
}

export interface Baseline {
  total: number;
  distribution: DistributionRow[];
}

function targetLabel(dataset: SourceId, field: string): string {
  return getField(dataset, field)?.label.toLowerCase() ?? field;
}

function strengthPhrase(pct: number): { lead: string; bias: boolean } {
  if (pct >= 90) return { lead: "With a very strong distinction like that", bias: true };
  if (pct >= 70) return { lead: "With a strong lean like that", bias: true };
  if (pct >= 60) return { lead: "With a moderate lean", bias: true };
  if (pct >= 55) return { lead: "With only a slight lean", bias: true };
  return { lead: "That is close to balanced", bias: false };
}

export function pct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 10000) / 100;
}

// Builds a human research-assistant style answer. All numbers come from the
// exact distribution computed against the database.
export function buildAnswer(
  plan: QueryPlan,
  total: number,
  distribution: DistributionRow[],
  baseline?: Baseline,
): string {
  const u = unit(plan.dataset);
  const us = unit(plan.dataset, false);
  const target = plan.targetField ?? "";
  const label = targetLabel(plan.dataset, target);

  if (total === 0) {
    return `I didn't find any ${u} matching those conditions. Try loosening the filters or widening the date range.`;
  }

  const meta = getField(plan.dataset, target);
  const isBias = meta?.type === "enum" && meta.values?.length === 2 && meta.values.includes("bullish");

  if (isBias) {
    const bull = distribution.find((d) => d.value === "bullish")?.count ?? 0;
    const bear = distribution.find((d) => d.value === "bearish")?.count ?? 0;
    const strongIsBear = bear >= bull;
    const side = strongIsBear ? "bearish" : "bullish";
    const strong = strongIsBear ? bear : bull;
    const weak = strongIsBear ? bull : bear;
    const sharePct = pct(strong, total);
    const { lead, bias } = strengthPhrase(sharePct);
    const parts: string[] = [];
    parts.push(`I found ${total} matching ${u}.`);
    parts.push(`Out of those, ${bull} ended bullish and ${bear} ended bearish.`);
    if (strong === weak) {
      parts.push(`That is an even split: ${bull} vs ${bear}.`);
      parts.push(`That is close to balanced, so I would not read a directional edge into this condition on its own.`);
    } else {
      parts.push(`The stronger side was ${side}: ${strong} vs ${weak}, or ${sharePct.toFixed(2)}% ${side}.`);
      if (bias) {
        parts.push(`${lead}, this condition points to a ${side} ${label} bias.`);
      } else {
        parts.push(`${lead}, so I would not lean hard on this condition by itself.`);
      }
    }
    if (baseline && baseline.total > 0 && plan.filters.length > 0) {
      const baseStrong = baseline.distribution.find((d) => d.value === side)?.count ?? 0;
      const basePct = pct(baseStrong, baseline.total);
      const edge = Math.round((sharePct - basePct) * 100) / 100;
      if (Math.abs(edge) >= 3) {
        parts.push(
          `For context, ${side} ${label} happens ${basePct.toFixed(2)}% of the time overall, so this lifts the odds by about ${Math.abs(edge).toFixed(1)} points.`,
        );
      } else {
        parts.push(`That is roughly in line with the ${basePct.toFixed(2)}% ${side} baseline, so the condition adds little on its own.`);
      }
    }
    return parts.join(" ");
  }

  // Generic categorical / numeric target.
  const top = distribution[0];
  const topPct = pct(top.count, total);
  const lines = [
    `I found ${total} matching ${u}.`,
    `The most common ${label} was "${top.value}" (${top.count} ${u}, ${topPct.toFixed(2)}%).`,
  ];
  if (distribution.length > 1) {
    const second = distribution[1];
    lines.push(
      `Next was "${second.value}" with ${second.count} ${u} (${pct(second.count, total).toFixed(2)}%).`,
    );
  }
  lines.push(`The full breakdown is below. Treat any single ${us} condition as a bias filter, not a standalone signal.`);
  return lines.join(" ");
}
