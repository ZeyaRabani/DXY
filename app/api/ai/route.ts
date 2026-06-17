import { NextResponse } from "next/server";
import { runAssistant, type PriorTurn } from "@/lib/ai/assistant";
import type { QueryPlan } from "@/lib/plan";

export const dynamic = "force-dynamic";

interface AiRequest {
  question?: string;
  history?: Array<{ question?: string; plan?: QueryPlan }>;
}

function cleanHistory(raw: AiRequest["history"]): PriorTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: PriorTurn[] = [];
  for (const h of raw) {
    if (h && typeof h.question === "string" && h.plan && typeof h.plan === "object" && Array.isArray(h.plan.filters)) {
      out.push({ question: h.question, plan: h.plan });
    }
  }
  return out.slice(-6);
}

export async function POST(req: Request) {
  let body: AiRequest;
  try {
    body = (await req.json()) as AiRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Please ask a question." }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "Question is too long." }, { status: 400 });
  }
  try {
    const result = await runAssistant(question, cleanHistory(body.history));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Assistant failed" },
      { status: 500 },
    );
  }
}
