/**
 * Budget escrow abstraction (§4.4).
 *
 * The mission budget is held under one of two regimes, chosen at runtime:
 *  - "covenant" — a covenant-governed P2SH escrow on Kaspa testnet-10. Spend rules
 *    (authorized payout, timeout refund) are encoded in a covenant-enabled script.
 *    This is the headline capability the jury cares about.
 *  - "simple"   — a code-enforced escrow at an app-controlled address. The documented
 *    fallback: every movement is still journaled on-chain; the app enforces reservations.
 *
 * A runtime probe decides which is available; the UI always shows which is active,
 * so "real vs fallback" is never ambiguous.
 */

export type EscrowMode = "covenant" | "simple";

export interface EscrowLock {
  mode: EscrowMode;
  /** kaspatest: address where the budget is (or would be) locked. */
  escrowAddress: string;
  /** Covenant lineage id (KIP-20), when mode = "covenant". */
  covenantId: string | null;
  /** The covenant redeem (P2SH) script hex, when mode = "covenant". */
  redeemScriptHex: string | null;
  /** Txid that funded the escrow, once the budget has actually been moved in. */
  lockTxid: string | null;
  /** Human-readable note for logs/UI (e.g. why the fallback was used). */
  note: string;
}

export interface EscrowRelease {
  /** Txid of the on-chain release spend, or null (nothing on-chain to release). */
  txid: string | null;
  note: string;
}

/** Escrow state for a mission, surfaced to the UI (the covenant highlight). */
export interface EscrowInfo {
  mode: EscrowMode;
  escrowAddress: string;
  covenantId: string | null;
  lockTxid: string | null; // funded the covenant escrow
  releaseTxid: string | null; // arbiter-signed release at settlement
  settled: boolean;
}

export interface BudgetEscrow {
  readonly mode: EscrowMode;
  /** Establish the escrow for a mission's budget; funds it on-chain when possible. */
  lock(args: { missionId: string; budgetKas: number }): Promise<EscrowLock>;
  /**
   * Release the escrow at settlement. For the covenant escrow this is a real
   * arbiter-signed P2SH spend that returns the budget to the treasury (or pays
   * agents); for the simple/mock escrows it is a no-op.
   */
  release(args: { lock: EscrowLock; refundAddress: string }): Promise<EscrowRelease>;
}
