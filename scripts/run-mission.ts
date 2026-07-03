/**
 * Console verification for the mission workflow (step 3).
 *
 *   pnpm run-mission
 *
 * Runs the Mastra `mission-workflow` end-to-end against the active ledger
 * (LEDGER=mock by default, AGENTS seeded by default → offline & deterministic):
 *   1. Happy path: createMission → plan → recon → handoff, printing the on-chain
 *      commitment chain the workflow produced.
 *   2. R1 gate: a mission whose recon reservation exceeds the approval threshold —
 *      the workflow SUSPENDS (REQUEST_BUDGET), then we resume with an approval and
 *      it proceeds. Proves budget enforcement is in code, via suspend/resume.
 */
import { mkdirSync } from "node:fs";
import { mastra, reconStep } from "@/mastra";
import { getLedger } from "@/mission-ledger";
import { referenceMissionSpec } from "@/mastra/seeds/mission";

mkdirSync(".data", { recursive: true });

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function printLog(missionId: string, title: string) {
  const ledger = await getLedger();
  const log = await ledger.getMissionLog(missionId);
  const budget = await ledger.getBudget(missionId);
  console.log(`\n  ${title} — ${log.length} commitments on the ledger:`);
  for (const c of log) {
    console.log(
      `    #${c.seq} ${c.type.padEnd(14)} ${c.actor.padEnd(16)} ` +
        `Δ${String(c.budgetDelta).padStart(4)}  ${c.onchain.padEnd(9)} ${c.txid?.slice(0, 10)}…`,
    );
  }
  console.log(`  budget: ${budget.remainingKas}/${budget.budgetKas} KAS remaining (spent ${budget.spentKas})`);
  return log;
}

async function happyPath() {
  console.log("\n═══ Scenario 1: happy path (no gate) ═══");
  const run = await mastra.getWorkflow("mission-workflow").createRun();
  const result = await run.start({ inputData: { spec: referenceMissionSpec } });

  assert(result.status === "success", `expected success, got ${result.status}`);
  const missionId: string = result.result.missionId;
  console.log(`  workflow: ${result.status} · reasoning source: ${result.result.reasoningSource}`);

  const log = await printLog(missionId, "Result");
  const types = log.map((c) => c.type);
  assert(types.includes("STEP_DONE"), "planner STEP_DONE missing");
  assert(types.filter((t) => t === "HANDOFF").length >= 2, "two handoffs expected (planner→recon→scanner)");
  assert(types.includes("RESERVE_BUDGET"), "recon RESERVE_BUDGET missing");
  assert(types.includes("PUBLISH_PROOF"), "recon PUBLISH_PROOF missing");
  // No gate on this path.
  assert(!types.includes("REQUEST_BUDGET"), "no budget request expected on happy path");
  console.log("  ✓ full recon flow, governed commitments, no gate.");
}

async function gatePath() {
  console.log("\n═══ Scenario 2: R1 budget gate (suspend → approve → resume) ═══");
  // Lower the approval threshold so recon's 2 KAS reservation trips the gate.
  const spec = {
    ...referenceMissionSpec,
    title: "Gate demo — low approval threshold",
    policy: { ...referenceMissionSpec.policy, humanApprovalThresholdKas: 1 },
  };

  const run = await mastra.getWorkflow("mission-workflow").createRun();
  const started = await run.start({ inputData: { spec } });

  assert(started.status === "suspended", `expected suspended, got ${started.status}`);
  console.log(`  workflow SUSPENDED at step: ${started.suspended?.join(", ")}`);

  // Operator approves.
  const resumed = await run.resume({ step: reconStep, resumeData: { approved: true, comment: "Approved by Sam." } });
  assert(resumed.status === "success", `expected success after resume, got ${resumed.status}`);
  const missionId: string = resumed.result.missionId;
  console.log(`  workflow resumed → ${resumed.status}`);

  const log = await printLog(missionId, "Result");
  const types = log.map((c) => c.type);
  assert(types.includes("REQUEST_BUDGET"), "REQUEST_BUDGET missing — gate did not fire");
  assert(types.includes("APPROVAL"), "APPROVAL (operator decision) missing");
  assert(types.includes("RESERVE_BUDGET"), "RESERVE_BUDGET after approval missing");
  const reqIdx = types.indexOf("REQUEST_BUDGET");
  const apprIdx = types.indexOf("APPROVAL");
  const resvIdx = types.indexOf("RESERVE_BUDGET");
  assert(reqIdx < apprIdx && apprIdx < resvIdx, "order must be REQUEST_BUDGET → APPROVAL → RESERVE_BUDGET");
  console.log("  ✓ R1 enforced in code: gate → human approval on-ledger → reservation.");
}

async function main() {
  await happyPath();
  await gatePath();
  console.log("\n✓ mission-workflow: planner + recon on-ledger, R1 gate via suspend/resume.\n");
}

main().catch((err) => {
  console.error("\n✗ run-mission failed:", err);
  process.exit(1);
});
