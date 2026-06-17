import "server-only";
import { parseQuestion } from "./parser";
import { llmPlan, llmNarrate, activeProvider, type PriorTurn } from "./llm";
import { buildAnswer, pct, unitLabel } from "./answer";
import { getField } from "../datasets";
import type { Filter, QueryPlan, ValidationIssue } from "../plan";
import { runDistribution, runRows, validatePlan } from "../query";

export interface DistRow {
  value: string;
  count: number;
  pct: number;
}

export interface AssistantResult {
  question: string;
  plan: QueryPlan;
  interpretation: string;
  matched: string[];
  answer: string;
  total: number;
  distribution: DistRow[];
  baseline: DistRow[];
  baselineTotal: number;
  sampleRows: Array<Record<string, unknown>>;
  issues: ValidationIssue[];
  source: "parser" | "llm";
}

export type { PriorTurn };

function describeFilter(dataset: QueryPlan["dataset"], f: Filter): string {
  const label = getField(dataset, f.field)?.label ?? f.field;
  if (f.op === "between" && Array.isArray(f.value)) {
    return `${label} between ${f.value[0]} and ${f.value[1]}`;
  }
  const opWord =
    f.op === "gte" ? "≥" : f.op === "lte" ? "≤" : f.op === "neq" ? "≠" : "=";
  if (typeof f.value === "boolean") return `${label} ${f.value ? "yes" : "no"}`;
  return `${label} ${opWord} ${f.value}`;
}

function sampleColumns(plan: QueryPlan): string[] {
  const cols = new Set<string>();
  const dateField =
    plan.dataset === "weekly" ? "week_start" : plan.dataset === "monthly" ? "month_start" : "full_date";
  cols.add(dateField);
  if (plan.targetField) cols.add(plan.targetField);
  for (const f of plan.filters) cols.add(f.field);
  return [...cols];
}

function defaultTarget(dataset: QueryPlan["dataset"]): string {
  if (dataset === "weekly") return "w_close";
  if (dataset === "monthly") return "m_close";
  return "d_close";
}

// Baseline (whole-dataset) distribution, cached briefly since it only changes
// when the daily cron appends a row. Used to frame how strong a condition is.
interface CachedBaseline {
  at: number;
  total: number;
  distribution: Array<{ value: string; count: number }>;
}
const baselineCache = new Map<string, CachedBaseline>();
const BASELINE_TTL = 10 * 60 * 1000;

async function getBaseline(
  dataset: QueryPlan["dataset"],
  targetField: string,
): Promise<{ total: number; distribution: Array<{ value: string; count: number }> }> {
  const key = `${dataset}:${targetField}`;
  const hit = baselineCache.get(key);
  if (hit && Date.now() - hit.at < BASELINE_TTL) {
    return { total: hit.total, distribution: hit.distribution };
  }
  const { total, distribution } = await runDistribution(dataset, targetField, []);
  baselineCache.set(key, { at: Date.now(), total, distribution });
  return { total, distribution };
}

export async function runAssistant(
  question: string,
  history: PriorTurn[] = [],
): Promise<AssistantResult> {
  const prevPlan = history.length ? history[history.length - 1].plan : null;

  // Layer 1: LLM plan (free provider) if configured; else deterministic parser.
  const llm = await llmPlan(question, history, prevPlan);
  const parsed = parseQuestion(question, prevPlan);

  let plan: QueryPlan;
  let interpretation: string;
  let matched: string[];
  let source: "parser" | "llm";
  if (llm && Array.isArray(llm.filters)) {
    plan = llm;
    source = "llm";
    matched = llm.filters.map((f) => describeFilter(llm.dataset, f));
    interpretation = `Looking at the ${llm.dataset} dataset${matched.length ? `, where ${matched.join(" and ")}` : ""}.`;
  } else {
    plan = parsed.plan;
    source = "parser";
    matched = parsed.matched;
    interpretation = parsed.interpretation;
  }

  // Validate + clean against the field whitelist (defence in depth).
  const { filters, issues } = validatePlan(plan);
  const cleanPlan: QueryPlan = {
    dataset: plan.dataset,
    targetField: plan.targetField ?? defaultTarget(plan.dataset),
    filters,
  };
  const targetField = cleanPlan.targetField as string;

  // Layer 2: execute exact queries against the database (counts never come from the model).
  const [{ total, distribution }, base, sample] = await Promise.all([
    runDistribution(cleanPlan.dataset, targetField, filters),
    getBaseline(cleanPlan.dataset, targetField),
    runRows(cleanPlan.dataset, filters, {
      columns: sampleColumns(cleanPlan),
      page: 1,
      pageSize: 8,
    }),
  ]);

  const distRows: DistRow[] = distribution.map((d) => ({ ...d, pct: pct(d.count, total) }));
  const baseRows: DistRow[] = base.distribution
    .map((d) => ({ ...d, pct: pct(d.count, base.total) }))
    .sort((a, b) => b.count - a.count);

  const meta = getField(cleanPlan.dataset, targetField);
  const isBias = meta?.type === "enum" && meta.values?.length === 2 && (meta.values?.includes("bullish") ?? false);

  // Layer 3: narrate the exact numbers conversationally (LLM), with a guard and a
  // deterministic fallback so figures are always trustworthy.
  let answer = await llmNarrate({
    question,
    datasetUnit: unitLabel(cleanPlan.dataset),
    targetLabel: meta?.label.toLowerCase() ?? targetField,
    conditions: filters.map((f) => describeFilter(cleanPlan.dataset, f)),
    total,
    isBias,
    distribution: distRows,
    baseline: isBias ? baseRows : undefined,
    baselineTotal: isBias ? base.total : undefined,
  });
  if (!answer) {
    answer = buildAnswer(cleanPlan, total, distribution, isBias ? { total: base.total, distribution: baseRows } : undefined);
  }

  return {
    question,
    plan: cleanPlan,
    interpretation,
    matched,
    answer,
    total,
    distribution: distRows,
    baseline: baseRows,
    baselineTotal: base.total,
    sampleRows: sample.rows,
    issues,
    source: activeProvider() ? source : "parser",
  };
}
