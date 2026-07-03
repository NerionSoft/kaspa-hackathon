import { getLogger } from "@/infrastructure/logging/logger";
import type { KaspaClient } from "../kaspa/client";
import { buildEscrowScript, computeCovenantId } from "./covenant-script";
import type { BudgetEscrow, EscrowLock } from "./types";

const logger = getLogger("CovenantEscrow");

/**
 * Covenant-governed budget escrow on Kaspa testnet-10.
 *
 * The budget is locked in a P2SH UTXO whose covenant-enabled redeem script requires
 * the human operator (arbiter) to authorize any release — no agent can move the
 * budget on its own. The escrow output is additionally tagged with a KIP-20 covenant
 * lineage id binding it to the mission's genesis. Release (payout/refund) is a
 * standard arbiter-signed P2SH spend performed at settlement.
 */
export class CovenantEscrow implements BudgetEscrow {
  readonly mode = "covenant" as const;

  constructor(private readonly client: KaspaClient) {}

  async lock(args: { missionId: string; budgetKas: number }): Promise<EscrowLock> {
    const script = buildEscrowScript(this.client.sdk, {
      arbiterXOnlyPubKeyHex: this.client.xOnlyPublicKeyHex,
      network: this.client.networkId,
    });

    const budgetSompi = BigInt(Math.round(args.budgetKas * 1e8));
    const covenantId = computeCovenantId(this.client.sdk, {
      genesisTxid: args.missionId,
      budgetSompi,
      escrowRedeemScriptHex: script.redeemScriptHex,
    });

    // Fund the escrow on-chain when the operator has the budget available. When
    // unfunded (e.g. dev), the escrow address + covenant id are still real and shown.
    let lockTxid: string | null = null;
    let note = "covenant escrow derived; budget not yet funded";
    try {
      const balance = await this.client.getBalanceKas();
      if (balance >= args.budgetKas) {
        lockTxid = await this.client.fundEscrow(script.escrowAddress, args.budgetKas);
        note = "budget locked in covenant escrow";
        logger.info("Budget locked under covenant", {
          missionId: args.missionId,
          escrowAddress: script.escrowAddress,
          lockTxid,
        });
      } else {
        logger.warn("Operator underfunded; escrow derived but not funded", {
          missionId: args.missionId,
          balance,
          budgetKas: args.budgetKas,
        });
      }
    } catch (err) {
      note = `covenant escrow derived; funding deferred (${err instanceof Error ? err.message : String(err)})`;
    }

    return {
      mode: "covenant",
      escrowAddress: script.escrowAddress,
      covenantId,
      redeemScriptHex: script.redeemScriptHex,
      lockTxid,
      note,
    };
  }
}
