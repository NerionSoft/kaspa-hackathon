import { env } from "@/infrastructure/config/env";
import { getLogger } from "@/infrastructure/logging/logger";
import type { OnchainStatus } from "@/domain/enums";
import { BaseLedger } from "../base-ledger";
import { createKaspaEscrow } from "../escrow";
import { buildEscrowScript } from "../escrow/covenant-script";
import type { BudgetEscrow, EscrowLock, EscrowRelease } from "../escrow/types";
import type { LedgerIndex } from "../store/ledger-index";
import { KaspaClient } from "./client";
import { KaspaRestIndexer } from "./rest-indexer";

const logger = getLogger("KaspaLedger");

/**
 * Real Mission Ledger on the Kaspa testnet. Writes each commitment as a payload
 * transaction (via {@link KaspaClient}) and reconciles the local index from the
 * chain (via {@link KaspaRestIndexer}). All bookkeeping — id/seq/prev chaining,
 * budget math, mission status — is inherited from {@link BaseLedger}; this class
 * only supplies the on-chain seams.
 *
 * The seq cursor is derived from the index (rebuildable from chain), so nothing
 * critical lives in memory.
 */
export class KaspaLedger extends BaseLedger {
  readonly backend = "kaspa" as const;

  private readonly client: KaspaClient;
  private readonly indexer: KaspaRestIndexer;
  private escrow?: BudgetEscrow;

  constructor(index: LedgerIndex, client = new KaspaClient(), indexer = new KaspaRestIndexer()) {
    super(index);
    this.client = client;
    this.indexer = indexer;
  }

  get operatorAddress(): string {
    return this.client.address;
  }

  protected async publishPayload(bytes: Uint8Array): Promise<{ txid: string; onchain: OnchainStatus }> {
    const txid = await this.client.submitPayload(bytes);
    return { txid, onchain: "pending" };
  }

  protected async lockBudget(missionId: string, budgetKas: number): Promise<EscrowLock> {
    // Decide covenant-vs-fallback once, on first use, via the runtime probe.
    if (!this.escrow) this.escrow = await createKaspaEscrow(this.client);
    return this.escrow.lock({ missionId, budgetKas });
  }

  protected async settleEscrow(missionId: string): Promise<EscrowRelease> {
    if (!this.escrow) this.escrow = await createKaspaEscrow(this.client);
    let lock = this.escrowLocks.get(missionId);

    // Reconstruct the covenant escrow if the in-memory lock is gone (e.g. server
    // restarted between run and settle). The P2SH escrow is deterministic from the
    // operator (arbiter) key, so address + redeem script are re-derivable.
    if (!lock) {
      const mission = await this.getMission(missionId);
      if (mission?.escrowMode === "covenant") {
        const script = buildEscrowScript(this.client.sdk, {
          arbiterXOnlyPubKeyHex: this.client.xOnlyPublicKeyHex,
          network: this.client.networkId,
        });
        lock = {
          mode: "covenant",
          escrowAddress: script.escrowAddress,
          covenantId: mission.covenantId,
          redeemScriptHex: script.redeemScriptHex,
          lockTxid: "reconstructed",
          note: "reconstructed for settlement",
        };
      }
    }
    if (!lock) return { txid: null, note: "no escrow to release" };
    // Refund the budget back to the operator treasury via an arbiter-signed spend.
    return this.escrow.release({ lock, refundAddress: this.client.address });
  }

  protected async reconcile(missionId: string): Promise<void> {
    try {
      const chain = await this.indexer.getMissionLog(this.client.address, missionId);
      for (const c of chain) {
        await this.index.updateCommitmentOnchain(c.id, {
          onchain: "confirmed",
          txid: c.txid,
          blockTime: c.blockTime,
        });
      }
    } catch (err) {
      // Offline resilience: keep the optimistic local view if REST is unreachable.
      logger.warn("Reconcile from chain failed; keeping local index view", {
        missionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  explorerTxUrl(txid: string): string {
    // The community testnet-10 web explorer is currently offline, so point at the
    // official REST API which returns the real, verifiable transaction (block time,
    // payload, acceptance) — an honest on-chain proof that always works.
    return `${env.kaspa.restUrl.replace(/\/$/, "")}/transactions/${txid}`;
  }
}
