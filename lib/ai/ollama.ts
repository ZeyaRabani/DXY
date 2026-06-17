import "server-only";
import type { QueryPlan } from "../plan";
import { DATASETS, type SourceId } from "../datasets";

// Optional local-LLM layer. It ONLY converts natural language into a JSON query
// plan; it never computes statistics. If OLLAMA_HOST is unset or unreachable the
// caller falls back to the deterministic parser. No paid keys are involved.

function schemaHint(): string {
  return (["daily", "weekly", "monthly"] as SourceId[])
    .map((d) => {
      const fields = DATASETS[d].fields
        .map((f) => (f.values ? `${f.field}(${f.values.join("|")})` : f.field))
        .join(", ");
      return `${d}: ${fields}`;
    })
    .join("\n");
}

function systemPrompt(question: string): string {
  return `You convert a trading question about the US Dollar Index (DXY) into a JSON query plan.
Datasets and their fields:
${schemaHint()}

Rules:
- Output ONLY minified JSON, no prose.
- Shape: {"dataset":"daily|weekly|monthly","targetField":"<field>","filters":[{"field":"<field>","op":"eq|neq|gte|lte|between","value":<value-or-[min,max]>}]}
- targetField is usually d_close, w_close, or m_close.
- Weekday values are mon,tue,wed,thu,fri. Bias values are bullish or bearish.
- Never invent fields outside the lists above.

Question: ${question}
JSON:`;
}

function isValidPlan(obj: unknown): obj is QueryPlan {
  if (!obj || typeof obj !== "object") return false;
  const p = obj as Record<string, unknown>;
  if (typeof p.dataset !== "string" || !DATASETS[p.dataset as SourceId]) return false;
  if (!Array.isArray(p.filters)) return false;
  return true;
}

export async function llmParse(question: string): Promise<QueryPlan | null> {
  const host = process.env.OLLAMA_HOST;
  if (!host) return null;
  const model = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${host.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: systemPrompt(question),
        stream: false,
        format: "json",
        options: { temperature: 0 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    if (!data.response) return null;
    const parsed = JSON.parse(data.response) as unknown;
    if (!isValidPlan(parsed)) return null;
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
