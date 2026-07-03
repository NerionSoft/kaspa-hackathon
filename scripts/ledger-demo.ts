/**
 * Offline proof for the Mission Ledger (LEDGER=mock).
 *
 *   pnpm ledger:demo
 *
 * Creates a mission, publishes a full commitment chain, prints the reconstructed
 * log + budget, and asserts the core invariants (monotonic seq, contiguous prev
 * chain, budget math). Deterministic and network-free.
 */
import { MockLedger } from "@/mission-ledger/mock/mock-ledger";
import { tryDecodeEnvelope, encodeEnvelope } from "@/mission-ledger/protocol";
import { buildCommitmentEnvelope } from "@/mission-ledger/build";
import { agentActor } from "@/domain/enums";
import { sha256Hex } from "@/mission-ledger/protocol";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  // Fixed clock → fully deterministic run.
  const ledger = new MockLedger({ now: () => 1_770_000_000_000 });

  const { missionId, txid } = await ledger.createMission({
    title: "Q3 external attack-surface audit",
    objective: "Authorized security audit of the staging OWASP Juice Shop instance.",
    target: "juice-shop.internal.staging",
    budgetKas: 10,
    rules:
      "Passive recon and non-destructive validation only. Active exploitation requires human approval. " +
      "Per-agent reservations capped at 3 KAS; any increase above 2 KAS needs Sam's approval.",
    policy: {
      perAgentBudgetCapKas: 3,
      humanApprovalThresholdKas: 2,
      highImpactActions: ["active_exploit"],
    },
    createdBy: "user:sam",
  });

  const mission = await ledger.getMission(missionId);
  console.log(`\n● Mission created (backend=${ledger.backend})`);
  console.log(`  missionId    : ${missionId}`);
  console.log(`  createTxid   : ${txid}`);
  console.log(`  budget       : ${mission?.budgetKas} KAS`);
  console.log(`  escrow mode  : ${mission?.escrowMode}`);
  console.log(`  escrow addr  : ${mission?.budgetAddress}`);
  console.log(`  covenant id  : ${mission?.covenantId ?? "—"}\n`);

  const proof = sha256Hex("recon-output: 14 endpoints, 3 entry points, nginx/1.25, Node 20");

  await ledger.publishCommitment({
    missionId, type: "CLAIM_TASK", actor: agentActor("recon"),
    rationale: "Recon claims the attack-surface mapping task.",
    body: { taskId: "t1" },
  });
  await ledger.publishCommitment({
    missionId, type: "RESERVE_BUDGET", actor: agentActor("recon"), budgetDelta: -2,
    rationale: "Reserve 2 KAS for scoped recon within the per-agent cap.",
  });
  await ledger.publishCommitment({
    missionId, type: "PUBLISH_PROOF", actor: agentActor("recon"), proofHash: proof,
    rationale: "Publish recon output hash; full artifact stored off-chain.",
  });
  await ledger.publishCommitment({
    missionId, type: "STEP_DONE", actor: agentActor("recon"),
    rationale: "Recon complete: attack surface mapped.",
  });
  await ledger.publishCommitment({
    missionId, type: "HANDOFF", actor: agentActor("recon"),
    rationale: "Hand off to scanner with the recon map.",
    body: { to: "scanner" },
  });

  const log = await ledger.getMissionLog(missionId);
  const budget = await ledger.getBudget(missionId);

  console.log("● Mission Ledger (reconstructed):");
  for (const c of log) {
    console.log(
      `  #${c.seq} ${c.type.padEnd(14)} ${c.actor.padEnd(16)} ` +
        `Δ${c.budgetDelta.toString().padStart(4)} KAS  ${c.onchain}  ${c.txid?.slice(0, 12)}…`,
    );
    console.log(`       prev=${c.prev ?? "∅"}  rationale="${c.rationale}"`);
  }
  console.log(
    `\n● Budget: ${budget.remainingKas} / ${budget.budgetKas} KAS remaining ` +
      `(spent ${budget.spentKas})\n`,
  );

  // --- Invariant checks ---
  assert(log.length === 5, "expected 5 commitments");
  log.forEach((c, i) => assert(c.seq === i, `seq must be contiguous at index ${i}`));
  log.forEach((c, i) =>
    assert(c.prev === (i === 0 ? null : log[i - 1].id), `prev chain broken at #${c.seq}`),
  );
  assert(budget.spentKas === 2, "spent should be 2 KAS");
  assert(budget.remainingKas === 8, "remaining should be 8 KAS");
  assert(log[2].proofHash === proof, "proof hash must round-trip");

  // Protocol round-trip: decode a payload back into an envelope.
  const env = buildCommitmentEnvelope(
    { missionId, type: "STEP_DONE", actor: "user:sam", budgetDelta: 0, rationale: "rt" },
    99,
    null,
  );
  const decoded = tryDecodeEnvelope(encodeEnvelope(env));
  assert(decoded && decoded.k === "commitment" && decoded.s === 99, "envelope round-trip failed");
  assert(tryDecodeEnvelope("deadbeef") === null, "non-mc payload must decode to null");

  assert(mission?.escrowMode === "covenant", "mock escrow should simulate covenant mode");
  assert(mission?.covenantId, "covenant id should be present");

  // Settle the mission and confirm it closes.
  await ledger.settle(missionId, {
    outcome: "completed",
    payouts: { "agent:recon": 2 },
    refundKas: 8,
    rationale: "Mission complete; pay recon, refund the remainder.",
  });
  const settled = await ledger.getMission(missionId);
  assert(settled?.status === "completed", "mission should be completed after settle");

  console.log("✓ All invariants hold (seq, prev-chain, budget, proof hash, protocol round-trip).");
  console.log("✓ Covenant escrow simulated; settlement closes the mission.");
  console.log("✓ MockLedger works fully offline (index-backed).\n");
}

main().catch((err) => {
  console.error("\n✗ ledger-demo failed:", err);
  process.exit(1);
});
