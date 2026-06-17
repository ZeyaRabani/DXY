import { NextResponse } from "next/server";
import { runAssistant } from "@/lib/ai/assistant";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { question?: string };
  try {
    body = (await req.json()) as { question?: string };
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
    const result = await runAssistant(question);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Assistant failed" },
      { status: 500 },
    );
  }
}
