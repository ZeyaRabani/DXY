import "server-only";
import type { QueryPlan } from "../plan";
import { DATASETS, type SourceId } from "../datasets";

// Provider-agnostic LLM layer. It is used for two jobs only:
//   1. Turn a natural-language question (+ conversation) into a JSON query plan.
//   2. Narrate the EXACT numbers we computed from the database in plain English.
// It NEVER computes statistics. All free providers are supported; if no key is
// configured the caller falls back to the deterministic parser + templated answer.

export type Provider = "gemini" | "groq" | "openrouter" | "ollama";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface ProviderConfig {
  name: Provider;
  model: string;
}

export function activeProvider(): ProviderConfig | null {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  const has = {
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    ollama: !!process.env.OLLAMA_HOST,
  };
  const pick = (p: Provider): ProviderConfig | null => {
    switch (p) {
      case "gemini":
        return has.gemini ? { name: p, model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash" } : null;
      case "groq":
        return has.groq ? { name: p, model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile" } : null;
      case "openrouter":
        return has.openrouter
          ? { name: p, model: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free" }
          : null;
      case "ollama":
        return has.ollama ? { name: p, model: process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b" } : null;
    }
  };
  if (forced && ["gemini", "groq", "openrouter", "ollama"].includes(forced)) {
    return pick(forced as Provider);
  }
  return pick("gemini") ?? pick("groq") ?? pick("openrouter") ?? pick("ollama");
}

export function llmEnabled(): boolean {
  return activeProvider() !== null;
}

const TIMEOUT_MS = 20000;

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Single entry point with one retry, so a transient failure or a brief
// rate-limit (Groq free tier) doesn't silently drop us to the fallback answer.
async function callModel(
  cfg: ProviderConfig,
  system: string,
  turns: ChatTurn[],
  json: boolean,
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await callModelOnce(cfg, system, turns, json);
    if (out && out.trim()) return out;
    if (attempt === 0) await sleep(1200);
  }
  return null;
}

async function callModelOnce(
  cfg: ProviderConfig,
  system: string,
  turns: ChatTurn[],
  json: boolean,
): Promise<string | null> {
  try {
    if (cfg.name === "gemini") {
      const key = process.env.GEMINI_API_KEY!;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${key}`;
      const body = {
        system_instruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.content }],
        })),
        generationConfig: {
          temperature: 0,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      };
      const res = await withTimeout((signal) =>
        fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal,
        }),
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? null;
    }

    // OpenAI-compatible providers (Groq, OpenRouter).
    if (cfg.name === "groq" || cfg.name === "openrouter") {
      const key = cfg.name === "groq" ? process.env.GROQ_API_KEY! : process.env.OPENROUTER_API_KEY!;
      const url =
        cfg.name === "groq"
          ? "https://api.groq.com/openai/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";
      const body = {
        model: cfg.model,
        temperature: 0,
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "system", content: system }, ...turns],
      };
      const res = await withTimeout((signal) =>
        fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal,
        }),
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? null;
    }

    // Ollama (local, no key).
    const host = process.env.OLLAMA_HOST!.replace(/\/$/, "");
    const prompt = `${system}\n\n${turns.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n")}\n\nASSISTANT:`;
    const res = await withTimeout((signal) =>
      fetch(`${host}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: cfg.model,
          prompt,
          stream: false,
          ...(json ? { format: "json" } : {}),
          options: { temperature: 0 },
        }),
        signal,
      }),
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    return data.response ?? null;
  } catch {
    return null;
  }
}

function schemaHint(): string {
  return (["daily", "weekly", "monthly"] as SourceId[])
    .map((d) => {
      const fields = DATASETS[d].fields
        .map((f) => (f.values ? `${f.field} (${f.values.join("|")})` : `${f.field} [${f.type}]`))
        .join(", ");
      return `- ${d}: ${fields}`;
    })
    .join("\n");
}

const PLAN_SYSTEM = `You translate questions about the US Dollar Index (DXY) into a strict JSON query plan.
You NEVER answer with statistics or prose — only the JSON plan. A separate engine runs the query.

Datasets and their queryable fields:
${schemaHint()}

Field meaning that trips people up:
- wh = the weekday the WEEK'S HIGH was made (mon..fri). wl = the weekday the WEEK'S LOW was made.
- "high of the week was Monday", "weekly high on Monday", "Monday high" -> filter wh = mon.
- "low of the week was Friday", "weekly low Friday", "Friday low" -> filter wl = fri.
- d_close / w_close / m_close are the daily/weekly/monthly candle direction: bullish or bearish.
- cpi_week / nfp_week / event_week are booleans (true/false). event_type is normal|cpi|nfp|both.

Rules:
- Choose ONE dataset. If the question is about weekly-high/low days or the weekly close, use "weekly".
  If about a whole month or monthly close, use "monthly". Otherwise "daily".
- targetField is what the user wants the distribution of — usually w_close, m_close, or d_close.
- Only use fields that exist in the chosen dataset (see the list). Never invent fields or values.
- Weekday values: mon,tue,wed,thu,fri. Bias values: bullish,bearish. Booleans: true,false.
- op is one of: eq, neq, gte, lte, between (value=[min,max]).
- Use the conversation so far to resolve follow-ups. If the user refines an earlier question
  ("what about...", "and the weekly close?", "now show monthly"), KEEP the still-relevant filters
  from the previous plan and only change what they changed.
- Output ONLY minified JSON, no markdown, with this exact shape:
  {"dataset":"daily|weekly|monthly","targetField":"<field>","filters":[{"field":"<field>","op":"eq","value":<v>}]}`;

interface RawPlan {
  dataset?: string;
  targetField?: string;
  filters?: unknown;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isPlanShape(obj: unknown): obj is RawPlan {
  if (!obj || typeof obj !== "object") return false;
  const p = obj as RawPlan;
  return typeof p.dataset === "string" && Array.isArray(p.filters);
}

// Build the conversation context string from prior resolved turns.
export interface PriorTurn {
  question: string;
  plan: QueryPlan;
}

export async function llmPlan(
  question: string,
  history: PriorTurn[],
  prevPlan: QueryPlan | null,
): Promise<QueryPlan | null> {
  const cfg = activeProvider();
  if (!cfg) return null;

  const turns: ChatTurn[] = [];
  for (const h of history.slice(-6)) {
    turns.push({ role: "user", content: h.question });
    turns.push({ role: "assistant", content: JSON.stringify(h.plan) });
  }
  const prefix = prevPlan
    ? `Previous plan (for follow-up context): ${JSON.stringify(prevPlan)}\n\n`
    : "";
  turns.push({ role: "user", content: `${prefix}Question: ${question}` });

  const raw = await callModel(cfg, PLAN_SYSTEM, turns, true);
  if (!raw) return null;
  const parsed = extractJson(raw);
  if (!isPlanShape(parsed)) return null;
  if (!DATASETS[parsed.dataset as SourceId]) return null;
  const filters = (parsed.filters as unknown[]).filter(
    (f): f is { field: string; op: string; value: unknown } =>
      !!f && typeof f === "object" && typeof (f as { field?: unknown }).field === "string",
  );
  return {
    dataset: parsed.dataset as SourceId,
    targetField: typeof parsed.targetField === "string" ? parsed.targetField : undefined,
    filters: filters.map((f) => ({
      field: f.field,
      op: (f.op as QueryPlan["filters"][number]["op"]) ?? "eq",
      value: f.value as QueryPlan["filters"][number]["value"],
    })),
  };
}

const NARRATE_SYSTEM = `You are a sharp, friendly markets research assistant for the US Dollar Index (DXY).
You are given the EXACT figures computed from a historical database. Write a short, natural reply.

Hard rules:
- Use ONLY the numbers provided in the FACTS. Never invent or recompute any number.
- Do not output markdown headings, bullet lists, JSON, or tables — just 2-4 conversational sentences.
- Lead with the direct answer (the count and the bullish/bearish split or top category).
- Add ONE genuine insight: how the lean compares to the overall baseline, and whether the sample is
  big enough to trust. Be honest when it is close to balanced or the sample is small.
- Sound like a person talking to a trader, not a report. No disclaimers boilerplate.`;

export interface NarrateFacts {
  question: string;
  datasetUnit: string; // "weeks", "days", "months"
  targetLabel: string; // "weekly close"
  conditions: string[]; // human-readable filter descriptions
  total: number;
  isBias: boolean;
  distribution: Array<{ value: string; count: number; pct: number }>;
  baseline?: Array<{ value: string; count: number; pct: number }>;
  baselineTotal?: number;
}

export async function llmNarrate(facts: NarrateFacts): Promise<string | null> {
  const cfg = activeProvider();
  if (!cfg) return null;
  const lines: string[] = [];
  lines.push(`Question: ${facts.question}`);
  lines.push(
    `Conditions: ${facts.conditions.length ? facts.conditions.join("; ") : "none (whole dataset)"}`,
  );
  lines.push(`Matching ${facts.datasetUnit}: ${facts.total}`);
  lines.push(
    `Distribution of ${facts.targetLabel}: ${facts.distribution
      .map((d) => `${d.value}=${d.count} (${d.pct.toFixed(2)}%)`)
      .join(", ")}`,
  );
  if (facts.baseline && facts.baselineTotal) {
    lines.push(
      `Baseline (all ${facts.datasetUnit}, ${facts.baselineTotal}): ${facts.baseline
        .map((d) => `${d.value}=${d.pct.toFixed(2)}%`)
        .join(", ")}`,
    );
  }
  const turns: ChatTurn[] = [{ role: "user", content: `FACTS:\n${lines.join("\n")}` }];
  const raw = await callModel(cfg, NARRATE_SYSTEM, turns, false);
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  return guardNumbers(text, facts) ? text : null;
}

// Reject a narration that introduces numbers we never gave it, so the model can
// never slip in a fabricated statistic. Small integers (<=12), years, and any
// figure present in the facts are allowed.
function guardNumbers(text: string, facts: NarrateFacts): boolean {
  const allowedInts = new Set<number>();
  const allowedPcts: number[] = [];
  allowedInts.add(facts.total);
  if (facts.baselineTotal) allowedInts.add(facts.baselineTotal);
  for (const d of facts.distribution) {
    allowedInts.add(d.count);
    allowedPcts.push(d.pct);
  }
  for (const d of facts.baseline ?? []) {
    allowedInts.add(d.count);
    allowedPcts.push(d.pct);
  }
  // Allow the difference between the lead share and baseline (a common insight).
  if (facts.distribution[0] && facts.baseline?.[0]) {
    allowedPcts.push(Math.abs(facts.distribution[0].pct - facts.baseline[0].pct));
  }
  const tokens = text.match(/\d+(?:\.\d+)?%?/g) ?? [];
  for (const tok of tokens) {
    if (tok.endsWith("%")) {
      const n = parseFloat(tok);
      if (!allowedPcts.some((p) => Math.abs(p - n) <= 1)) return false;
    } else {
      const n = Number(tok);
      if (Number.isInteger(n)) {
        if (n <= 12) continue; // ratios like "9 out of 10", "2 to 1"
        if (n >= 1900 && n <= 2100) continue; // years
        if (!allowedInts.has(n)) return false;
      } else {
        // a decimal without %; only allow if it matches an allowed pct value
        if (!allowedPcts.some((p) => Math.abs(p - n) <= 1)) return false;
      }
    }
  }
  return true;
}
