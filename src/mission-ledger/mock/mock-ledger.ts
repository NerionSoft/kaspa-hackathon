import type { OnchainStatus } from "@/domain/enums";
import { BaseLedger } from "../base-ledger";
import { MockEscrow } from "../escrow/mock-escrow";
import type { EscrowLock } from "../escrow/types";
import { sha256Hex } from "../protocol";
import { LedgerIndex } from "../store/ledger-index";

/**
 * In-memory, deterministic Mission Ledger. Runs fully offline so the demo never
 * depends on the network. Txids are content hashes: they look like real Kaspa
 * txids and are reproducible for a given input sequence.
 *
 * It MIRRORS KaspaLedger exactly (same envelopes, id/seq/prev chaining, budget
 * math — all inherited from BaseLedger); the only differences are that payloads
 * are hashed instead of broadcast and commitments confirm instantly.
 */
export class MockLedger extends BaseLedger {
  readonly backend = "mock" as const;

  private counter = 0;
  private readonly clock: () => number;
  private readonly escrow = new MockEscrow();

  constructor(opts: { now?: () => number; index?: LedgerIndex } = {}) {
    super(opts.index ?? new LedgerIndex(":memory:"));
    this.clock = opts.now ?? (() => Date.now());
  }

  protected now(): number {
    return this.clock();
  }

  protected async publishPayload(bytes: Uint8Array): Promise<{ txid: string; onchain: OnchainStatus }> {
    // Content-hash + nonce → a unique, deterministic, testnet-shaped txid.
    const txid = sha256Hex(Buffer.concat([bytes, Buffer.from(`#${this.counter++}`)]));
    return { txid, onchain: "confirmed" }; // the mock confirms instantly
  }

  protected async lockBudget(missionId: string, budgetKas: number): Promise<EscrowLock> {
    return this.escrow.lock({ missionId, budgetKas });
  }

  explorerTxUrl(): string {
    return ""; // mock txids are not on any explorer
  }
}
