import AiChat from "@/components/AiChat";

export const metadata = { title: "V2 AI Assistant — DXY Research" };

export default function V2AiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">V2 — Research assistant</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          A natural-language assistant for the DXY datasets. It turns your
          question into an exact query against the database, runs the real
          calculation, and replies like a research assistant. Every answer is
          backed by the query plan, full distribution and sample rows shown
          beneath it.
        </p>
      </div>
      <AiChat />
    </div>
  );
}
