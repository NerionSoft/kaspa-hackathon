import type { KaspaSdk } from "../kaspa/sdk";

/**
 * Pure, offline construction of the budget-escrow covenant.
 *
 * The redeem script is built with a covenant-enabled ScriptBuilder (post-Toccata
 * script limits, KIP-17). The budget UTXO is a P2SH output governed by this script
 * and additionally tagged with a KIP-20 covenant lineage id, so the escrow's funds
 * are provably a member of the mission covenant.
 *
 * Spend policy encoded: release requires the arbiter (the human operator, "Sam")
 * to authorize — i.e. no agent can move the budget out of escrow on its own. Richer
 * introspection constraints (enforce payout destination on-chain) are a documented
 * next increment that needs a funded testnet run to verify opcode semantics; the
 * arbiter-authorized P2SH lock here is standard and derives a real testnet address.
 */

export interface EscrowScript {
  redeemScriptHex: string;
  escrowAddress: string;
}

export function buildEscrowScript(
  kaspa: KaspaSdk,
  args: { arbiterXOnlyPubKeyHex: string; network: string },
): EscrowScript {
  const { Opcodes, ScriptBuilder, payToScriptHashScript, addressFromScriptPublicKey } =
    kaspa as unknown as {
      Opcodes: Record<string, number>;
      ScriptBuilder: new (opts?: { flags?: { covenantsEnabled?: boolean } }) => {
        addData(data: string | Uint8Array): unknown;
        addOp(op: number): unknown;
        drain(): string;
      };
      payToScriptHashScript: (redeem: string) => unknown;
      addressFromScriptPublicKey: (spk: unknown, network: string) => { toString(): string } | undefined;
    };

  const sb = new ScriptBuilder({ flags: { covenantsEnabled: true } });
  sb.addData(args.arbiterXOnlyPubKeyHex);
  sb.addOp(Opcodes.OpCheckSig);
  const redeemScriptHex = sb.drain();

  const spk = payToScriptHashScript(redeemScriptHex);
  const address = addressFromScriptPublicKey(spk, args.network);
  if (!address) throw new Error("failed to derive escrow P2SH address");

  return { redeemScriptHex, escrowAddress: address.toString() };
}

/**
 * Compute the KIP-20 covenant lineage id binding the budget output to the mission's
 * genesis outpoint. Fully offline / deterministic — demonstrates the covenant-id layer.
 */
export function computeCovenantId(
  kaspa: KaspaSdk,
  args: { genesisTxid: string; budgetSompi: bigint; escrowRedeemScriptHex: string },
): string {
  const { covenantId, payToScriptHashScript, ScriptPublicKey, TransactionOutput } =
    kaspa as unknown as {
      covenantId: (outpoint: { transactionId: string; index: number }, auth: { index: number; output: unknown }[]) => { toString(): string };
      payToScriptHashScript: (redeem: string) => unknown;
      ScriptPublicKey: unknown;
      TransactionOutput: new (value: bigint, spk: unknown) => unknown;
    };
  void ScriptPublicKey;

  const escrowSpk = payToScriptHashScript(args.escrowRedeemScriptHex);
  const budgetOutput = new TransactionOutput(args.budgetSompi, escrowSpk);
  const id = covenantId({ transactionId: args.genesisTxid, index: 0 }, [
    { index: 0, output: budgetOutput },
  ]);
  return id.toString();
}
