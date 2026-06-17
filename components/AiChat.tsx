"use client";

import { useEffect, useRef, useState } from "react";
import { titleCase } from "@/lib/format";

interface PlanFilter {
  field: string;
  op: string;
  value: string | number | boolean | Array<string | number>;
}
interface QueryPlanShape {
  dataset: string;
  targetField?: string;
  filters: PlanFilter[];
}
interface AssistantResult {
  question: string;
  plan: QueryPlanShape;
  interpretation: string;
  matched: string[];
  answer: string;
  total: number;
  distribution: Array<{ value: string; count: number; pct: number }>;
  baseline?: Array<{ value: string; count: number; pct: number }>;
  baselineTotal?: number;
  sampleRows: Array<Record<string, unknown>>;
  source: "parser" | "llm";
  error?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  result?: AssistantResult;
}

const EXAMPLES = [
  "What was the weekly close when the high of the week was Monday and the monthly close was bearish?",
  "Monthly close bias when the previous month closed bullish",
  "How does the daily close behave on Fridays?",
  "Weekly close when the weekly low was Friday during a CPI week",
];

export default function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    // Send the resolved plans of prior turns so follow-ups keep context.
    const history = messages
      .filter((m) => m.role === "assistant" && m.result)
      .slice(-6)
      .map((m) => ({ question: m.result!.question, plan: m.result!.plan }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const json = (await res.json()) as AssistantResult;
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", text: json.error ?? "Something went wrong." }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: json.answer, result: json }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-panel">
        <div className="max-h-[55vh] space-y-4 overflow-y-auto scroll-thin p-4">
          {messages.length === 0 && (
            <div className="space-y-3 text-sm text-muted">
              <p>
                Ask about historical DXY behaviour in plain English. I convert your
                question into an exact database query and answer from the real
                numbers — I never make figures up. Conversation is kept only for
                this browser session and is cleared when you refresh.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => ask(ex)}
                    className="rounded-full border border-border bg-panel-2 px-3 py-1.5 text-left text-xs hover:border-accent/50 hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-accent/15 text-foreground"
                    : "bg-panel-2 text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                {msg.result && <Audit result={msg.result} />}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-panel-2 px-3 py-2 text-sm text-muted">Analysing…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about DXY patterns…"
            className="flex-1 rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      </div>

      {messages.length > 0 && (
        <button
          onClick={() => setMessages([])}
          className="self-start text-xs text-muted underline-offset-2 hover:underline"
        >
          Clear conversation
        </button>
      )}
    </div>
  );
}

function Audit({ result }: { result: AssistantResult }) {
  const { plan, distribution, sampleRows, total, source, matched } = result;
  return (
    <details className="mt-3 rounded-md border border-border bg-panel/60 p-2 text-xs">
      <summary className="cursor-pointer select-none text-muted">
        Show supporting query, distribution & sample rows
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-1 font-medium text-muted">Query plan ({source})</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>dataset: {plan.dataset}</Chip>
            {plan.targetField && <Chip>target: {plan.targetField}</Chip>}
            {plan.filters.map((f, i) => (
              <Chip key={i}>
                {f.field} {f.op} {Array.isArray(f.value) ? f.value.join("–") : String(f.value)}
              </Chip>
            ))}
            {plan.filters.length === 0 && <span className="text-muted">no filters</span>}
          </div>
          {matched.length > 0 && (
            <p className="mt-1 text-muted">Understood as: {matched.join(", ")}.</p>
          )}
        </div>

        {result.baseline && result.baseline.length > 0 && result.plan.filters.length > 0 && (
          <div>
            <div className="mb-1 font-medium text-muted">
              Baseline · all {result.plan.dataset} ({result.baselineTotal})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.baseline.map((d) => (
                <Chip key={d.value}>
                  {d.value}: {d.pct.toFixed(2)}%
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 font-medium text-muted">Distribution ({total} rows)</div>
          <div className="space-y-1">
            {distribution.map((d) => (
              <div key={d.value} className="flex items-center gap-2">
                <span className="w-20 shrink-0 capitalize">{d.value}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <div
                    className={d.value === "bearish" ? "h-full bg-bear" : d.value === "bullish" ? "h-full bg-bull" : "h-full bg-accent"}
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right tabular-nums">
                  {d.count} · {d.pct.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {sampleRows.length > 0 && (
          <div>
            <div className="mb-1 font-medium text-muted">Sample rows</div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-max text-left">
                <thead className="text-muted">
                  <tr>
                    {Object.keys(sampleRows[0]).map((k) => (
                      <th key={k} className="px-2 py-1 font-medium">{titleCase(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {Object.keys(sampleRows[0]).map((k) => (
                        <td key={k} className="whitespace-nowrap px-2 py-1 capitalize tabular-nums">
                          {formatCell(row[k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-panel-2 px-1.5 py-0.5 font-mono text-[11px]">
      {children}
    </span>
  );
}
