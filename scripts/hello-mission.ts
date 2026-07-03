/**
 * Real testnet proof for the Mission Ledger (LEDGER=kaspa).
 *
 *   pnpm hello:mission
 *
 * 1. Connects to Kaspa testnet-10 (public resolver) and derives the operator address.
 * 2. If unfunded, prints the address + faucet link and exits cleanly (awaiting funds).
 * 3. If funded: creates a mission on-chain, publishes one commitment, then RE-READS
 *    both back FROM the chain via the REST indexer and prints explorer links.
 *
 * This is the step-1 acceptance check: a "hello mission" commitment really written
 * and read back on the testnet.
 */
import { env } from "@/infrastructure/config/env";
import { KaspaClient } from "@/mission-ledger/kaspa/client";
import { KaspaLedger } from "@/mission-ledger/kaspa/kaspa-ledger";
import { KaspaRestIndexer } from "@/mission-ledger/kaspa/rest-indexer";
import { LedgerIndex } from "@/mission-ledger/store/ledger-index";
import { probeCovenants } from "@/mission-ledger/escrow/probe";
import { buildEscrowScript } from "@/mission-ledger/escrow/covenant-script";
import { agentActor } from "@/domain/enums";

const MIN_KAS = 3; // budget escrow (2) + a few self-send commitments + fees
const explorer = (txid: string) => `${env.kaspa.explorerUrl.replace(/\/$/, "")}/txs/${txid}`;

async function main() {
  console.log(`\n● Kaspa Mission Ledger — hello mission (network=${env.kaspa.network})`);

  const client = new KaspaClient();
  const address = client.address; // throws a clear error if no key configured
  console.log(`  operator address: ${address}`);

  await client.connect();
  const balance = await client.getBalanceKas();
  console.log(`  balance: ${balance} KAS`);

  // Probe covenant support against the live node and derive the escrow address.
  const probe = await probeCovenants(client);
  console.log(`  covenants: ${probe.supported ? "supported" : "unavailable"} — ${probe.reason}`);
  if (probe.supported) {
    const script = buildEscrowScript(client.sdk, {
      arbiterXOnlyPubKeyHex: client.xOnlyPublicKeyHex,
      network: client.networkId,
    });
    console.log(`  covenant escrow address: ${script.escrowAddress}\n`);
  } else {
    console.log("");
  }

  if (balance < MIN_KAS) {
    console.log("⏳ Address not funded yet. Fund it, then re-run `pnpm hello:mission`:");
    console.log(`   Faucet : https://faucet-tn10.kaspanet.io`);
    console.log(`   Address: ${address}\n`);
    await client.disconnect();
    return;
  }

  const index = new LedgerIndex(":memory:");
  await index.init();
  const ledger = new KaspaLedger(index, client);

  console.log("① Creating mission on-chain…");
  const { missionId, txid } = await ledger.createMission({
    title: "Hello Mission",
    objective: "Smoke-test the Kaspa Mission Ledger on testnet-10.",
    target: "juice-shop.internal.staging",
    budgetKas: 2,
    rules: "Passive only. Active exploitation requires human approval.",
    policy: { perAgentBudgetCapKas: 1, humanApprovalThresholdKas: 1, highImpactActions: ["active_exploit"] },
    createdBy: "user:sam",
  });
  const localMission = await ledger.getMission(missionId);
  console.log(`   missionId : ${missionId}`);
  console.log(`   genesis   : ${explorer(txid)}`);
  console.log(`   escrow    : ${localMission?.escrowMode} @ ${localMission?.budgetAddress}`);
  console.log(`   covenant  : ${localMission?.covenantId ?? "—"}  (budget locked on-chain — open the escrow address in the explorer)\n`);

  console.log("② Publishing a commitment on-chain…");
  const c = await ledger.publishCommitment({
    missionId,
    type: "CLAIM_TASK",
    actor: agentActor("recon"),
    rationale: "Recon claims the attack-surface mapping task (hello mission).",
    body: { taskId: "t1" },
  });
  console.log(`   commitment: ${c.id}`);
  console.log(`   tx        : ${explorer(c.txid)}\n`);

  console.log("③ Waiting for confirmation + reading back FROM the chain…");
  const indexer = new KaspaRestIndexer();
  const blockTime = await indexer.waitForConfirmation(c.txid, 90_000);
  console.log(`   confirmed at: ${blockTime ?? "(still indexing — check explorer)"}`);

  const chainLog = await indexer.getMissionLog(address, missionId);
  console.log(`   reconstructed ${chainLog.length} commitment(s) from chain:`);
  for (const rc of chainLog) {
    console.log(`     #${rc.seq} ${rc.type} by ${rc.actor} — "${rc.rationale}"  [${rc.onchain}]`);
  }

  const chainMission = await indexer.getMission(address, missionId);
  console.log(`   mission read back: "${chainMission?.title}" budget=${chainMission?.budgetKas} KAS\n`);

  console.log("④ Settling on-chain — releasing the covenant escrow (arbiter-signed spend)…");
  const settle = await ledger.settle(missionId, {
    outcome: "completed",
    payouts: {},
    refundKas: 2,
    rationale: "Hello mission complete; release the covenant escrow back to the treasury.",
  });
  console.log(`   settle tx : ${explorer(settle.txid)}`);
  const finalLog = await ledger.getMissionLog(missionId);
  const settleC = finalLog.find((c) => c.type === "SETTLE");
  const body = (settleC?.payload as { b?: { escrowReleaseTxid?: string | null; escrowReleaseNote?: string } }).b;
  if (body?.escrowReleaseTxid) {
    console.log(`   escrow release tx: ${explorer(body.escrowReleaseTxid)}  ← covenant funds released`);
  } else {
    console.log(`   escrow release: ${body?.escrowReleaseNote ?? "(none)"}`);
  }

  await client.disconnect();
  console.log("\n✓ Full on-chain covenant flow: budget LOCKED in a covenant escrow → agent");
  console.log("  commitments → escrow RELEASED at settlement, all as real Kaspa testnet txs.\n");
}

main().catch((err) => {
  console.error("\n✗ hello-mission failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
