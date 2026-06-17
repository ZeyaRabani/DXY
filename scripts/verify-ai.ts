// Independent verification: query Supabase DIRECTLY (a separate code path from
// the assistant's query engine), then run the AI on the same plain-English
// question and confirm the numbers match exactly.
import { getServerSupabase } from "../lib/supabase";
import { runAssistant } from "../lib/ai/assistant";

interface Case {
  question: string;
  wh: string;
  wl?: string;
  m_close?: string;
}

const CASES: Case[] = [
  { question: "What was the weekly close when the weekly high was monday and weekly low was tuesday?", wh: "mon", wl: "tue" },
  { question: "what about monday high and friday low?", wh: "mon", wl: "fri" },
  { question: "What was the weekly close when the high of the week was Monday and the monthly close was bearish?", wh: "mon", m_close: "bearish" },
];

async function directCount(c: Case): Promise<{ total: number; bullish: number; bearish: number }> {
  const sb = getServerSupabase();
  let q = sb.from("dxy_weekly_v2").select("w_close").eq("wh", c.wh);
  if (c.wl) q = q.eq("wl", c.wl);
  if (c.m_close) q = q.eq("m_close", c.m_close);
  const { data, error } = await q;
  if (error) throw error;
  let bullish = 0;
  let bearish = 0;
  for (const row of (data ?? []) as Array<{ w_close: string }>) {
    if (row.w_close === "bullish") bullish++;
    else if (row.w_close === "bearish") bearish++;
  }
  return { total: (data ?? []).length, bullish, bearish };
}

async function main() {
  let allPass = true;
  for (const c of CASES) {
    const direct = await directCount(c);
    const ai = await runAssistant(c.question, []);
    const aiBull = ai.distribution.find((d) => d.value === "bullish")?.count ?? 0;
    const aiBear = ai.distribution.find((d) => d.value === "bearish")?.count ?? 0;
    const match =
      ai.total === direct.total && aiBull === direct.bullish && aiBear === direct.bearish;
    allPass = allPass && match;
    console.log(`\nQ: ${c.question}`);
    console.log(`  DIRECT DB  -> total ${direct.total}, bullish ${direct.bullish}, bearish ${direct.bearish}`);
    console.log(`  AI (${ai.source})  -> total ${ai.total}, bullish ${aiBull}, bearish ${aiBear}`);
    console.log(`  plan: ${JSON.stringify(ai.plan)}`);
    console.log(`  MATCH: ${match ? "YES ✅" : "NO ❌"}`);
    console.log(`  answer: ${ai.answer}`);
  }
  console.log(`\n==== ${allPass ? "ALL MATCH" : "MISMATCH FOUND"} ====`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
