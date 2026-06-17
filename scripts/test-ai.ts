import { runAssistant, type PriorTurn } from "../lib/ai/assistant";

async function main() {
  console.log("provider:", process.env.LLM_PROVIDER ?? "(auto)");

  // Q1: the exact failing phrasing.
  const q1 = "what about monday high and friday low?";
  const r1 = await runAssistant(q1, []);
  console.log("\nQ1:", q1);
  console.log("  source:", r1.source);
  console.log("  plan:", JSON.stringify(r1.plan));
  console.log("  total:", r1.total, "dist:", JSON.stringify(r1.distribution));
  console.log("  answer:", r1.answer);

  // Q2: follow-up that must inherit the wh=mon, wl=fri context.
  const q2 = "so what would be the weekly close?";
  const history: PriorTurn[] = [{ question: q1, plan: r1.plan }];
  const r2 = await runAssistant(q2, history);
  console.log("\nQ2:", q2);
  console.log("  source:", r2.source);
  console.log("  plan:", JSON.stringify(r2.plan));
  console.log("  total:", r2.total, "dist:", JSON.stringify(r2.distribution));
  console.log("  answer:", r2.answer);

  // Acceptance query regression check.
  const q3 =
    "What was the weekly close when the high of the week was Monday and the monthly close was bearish?";
  const r3 = await runAssistant(q3, []);
  console.log("\nQ3 (acceptance):", q3);
  console.log("  source:", r3.source);
  console.log("  plan:", JSON.stringify(r3.plan));
  console.log("  total:", r3.total, "dist:", JSON.stringify(r3.distribution));
  console.log("  answer:", r3.answer);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
