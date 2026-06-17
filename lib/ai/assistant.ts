import "server-only";
import { parseQuestion } from "./parser";
import { llmParse } from "./ollama";
import { buildAnswer, pct } from "./answer";
import { getField } from "../datasets";
import type { Filter, QueryPlan, ValidationIssue } from "../plan";
import { runDistribution, runRows, validatePlan } from "../query";

export interface AssistantResult {
  question: string;
  plan: QueryPlan;
  interpretation: string;
  matched: string[];
  answer: string;
  total: number;
  distribution: Array<{ value: string; count: number; pct: number }>;
  sampleRows: Array<Record<string, unknown>>;
  issues: ValidationIssue[];
  source: "parser" | "llm";
}

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
  // Always include the dataset's date field + target + filter fields.
  const dateField =
    plan.dataset === "weekly" ? "week_start" : plan.dataset === "monthly" ? "month_start" : "full_date";
  cols.add(dateField);
  if (plan.targetField) cols.add(plan.targetField);
  for (const f of plan.filters) cols.add(f.field);
  return [...cols];
}

export async function runAssistant(question: string): Promise<AssistantResult> {
  // Layer 1/2: optional LLM plan, else deterministic parser.
  const llm = await llmParse(question);
  const parsed = parseQuestion(question);
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

  // Layer 3/4: execute exact queries against the database.
  const targetField = cleanPlan.targetField as string;
  const { total, distribution } = await runDistribution(cleanPlan.dataset, targetField, filters);
  const sample = await runRows(cleanPlan.dataset, filters, {
    columns: sampleColumns(cleanPlan),
    page: 1,
    pageSize: 8,
  });

  const answer = buildAnswer(cleanPlan, total, distribution);

  return {
    question,
    plan: cleanPlan,
    interpretation,
    matched,
    answer,
    total,
    distribution: distribution.map((d) => ({ ...d, pct: pct(d.count, total) })),
    sampleRows: sample.rows,
    issues,
    source,
  };
}

function defaultTarget(dataset: QueryPlan["dataset"]): string {
  if (dataset === "weekly") return "w_close";
  if (dataset === "monthly") return "m_close";
  return "d_close";
}
