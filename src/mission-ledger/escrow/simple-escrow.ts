import type { KaspaClient } from "../kaspa/client";
import type { BudgetEscrow, EscrowLock, EscrowRelease } from "./types";

/**
 * Code-enforced budget escrow (the documented §4.4 fallback).
 *
 * The budget stays at the operator address; the application enforces reservations
 * and every movement is journaled on-chain as a commitment. Same UX and demo story
 * as the covenant escrow, minus covenant-level on-chain enforcement. Used when the
 * covenant probe fails, so the demo never depends on covenant availability.
 */
export class SimpleEscrow implements BudgetEscrow {
  readonly mode = "simple" as const;

  constructor(
    private readonly client: KaspaClient,
    private readonly reason = "covenant unavailable",
  ) {}

  async lock(): Promise<EscrowLock> {
    return {
      mode: "simple",
      escrowAddress: this.client.address,
      covenantId: null,
      redeemScriptHex: null,
      lockTxid: null,
      note: `code-enforced escrow (${this.reason})`,
    };
  }

  async release(): Promise<EscrowRelease> {
    // No on-chain lock to unwind — the budget stayed at the operator address.
    return { txid: null, note: "code-enforced escrow — settlement is journaled, no release spend" };
  }
}
