import { sha256Hex } from "../protocol";
import type { BudgetEscrow, EscrowLock } from "./types";

/**
 * Simulated covenant escrow for the MockLedger. Produces deterministic, realistic
 * covenant artefacts (escrow address + lineage id) so the offline demo shows the
 * full covenant narrative without a network. Explicitly part of the simulated
 * ledger — never presented as a real on-chain lock.
 */
export class MockEscrow implements BudgetEscrow {
  readonly mode = "covenant" as const;

  async lock(args: { missionId: string; budgetKas: number }): Promise<EscrowLock> {
    const covenantId = sha256Hex(`covenant:${args.missionId}:${args.budgetKas}`);
    const escrowAddress = `kaspatest:pmock${covenantId.slice(0, 54)}`;
    return {
      mode: "covenant",
      escrowAddress,
      covenantId,
      redeemScriptHex: null,
      lockTxid: `mock-lock-${covenantId.slice(0, 16)}`,
      note: "simulated covenant escrow (mock ledger)",
    };
  }
}
