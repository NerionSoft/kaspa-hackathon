import { env } from "@/infrastructure/config/env";
import { getLogger } from "@/infrastructure/logging/logger";
import type { Commitment, Mission } from "@/domain/entities";
import { commitmentFromEnvelope, missionFromGenesis } from "../build";
import { LedgerNetworkError } from "../errors";
import { tryDecodeEnvelope } from "../protocol";
import type { AnyEnvelope, MissionGenesisEnvelope } from "../protocol";

const logger = getLogger("KaspaIndexer");

/** Minimal shape of the kaspa-rest-server TxModel we depend on. */
interface RestTx {
  transaction_id?: string;
  transactionId?: string;
  payload?: string | null;
  block_time?: number | null;
  accepting_block_time?: number | null;
  is_accepted?: boolean;
}

function txId(tx: RestTx): string | undefined {
  return tx.transaction_id ?? tx.transactionId;
}

function txTimeIso(tx: RestTx): string | null {
  const ms = tx.accepting_block_time ?? tx.block_time;
  return ms ? new Date(ms).toISOString() : null;
}

/**
 * Reads Mission Control commitments back FROM the Kaspa testnet via the community
 * REST indexer. The chain is the source of truth; everything here is a
 * reconstructible projection of it, filtered by the `mc` payload magic.
 */
export class KaspaRestIndexer {
  private readonly base: string;

  constructor(base = env.kaspa.restUrl) {
    this.base = base.replace(/\/$/, "");
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.base}${path}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { accept: "application/json" } });
    } catch (err) {
      throw new LedgerNetworkError(`Kaspa REST request failed: ${url}`, {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
    if (res.status === 404) return null as T;
    if (!res.ok) {
      throw new LedgerNetworkError(`Kaspa REST ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  }

  /** Raw transaction (with hex payload) by id, or null if not yet indexed. */
  async getTransaction(txid: string): Promise<RestTx | null> {
    return this.get<RestTx | null>(`/transactions/${txid}?resolve_previous_outpoints=no`);
  }

  /** All transactions touching an address, newest first, up to `limit`. */
  async getAddressTxs(address: string, limit = 500): Promise<RestTx[]> {
    const path =
      `/addresses/${encodeURIComponent(address)}/full-transactions` +
      `?limit=${limit}&resolve_previous_outpoints=no`;
    const txs = await this.get<RestTx[] | null>(path);
    return txs ?? [];
  }

  /**
   * Wait until a submitted tx is indexed/accepted (or time out). Returns the
   * block time (ISO) once available. This is our confirmation signal.
   */
  async waitForConfirmation(txid: string, timeoutMs = 60_000): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const tx = await this.getTransaction(txid);
      if (tx && (tx.is_accepted !== false)) {
        return txTimeIso(tx);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    logger.warn("Confirmation timed out", { txid });
    return null;
  }

  /** Decode every Mission Control envelope on an address into (genesis, commitments). */
  async scanAddress(address: string): Promise<{
    genesis: Map<string, { txid: string; env: MissionGenesisEnvelope; time: string | null }>;
    commitments: Commitment[];
  }> {
    const txs = await this.getAddressTxs(address);
    const genesis = new Map<string, { txid: string; env: MissionGenesisEnvelope; time: string | null }>();
    const commitments: Commitment[] = [];

    for (const tx of txs) {
      const id = txId(tx);
      if (!id || !tx.payload) continue;
      let env: AnyEnvelope | null;
      try {
        env = tryDecodeEnvelope(tx.payload);
      } catch {
        logger.warn("Skipping undecodable Mission Control payload", { txid: id });
        continue;
      }
      if (!env) continue;

      const time = txTimeIso(tx);
      if (env.k === "mission") {
        genesis.set(id, { txid: id, env, time });
      } else {
        commitments.push(
          commitmentFromEnvelope({ envelope: env, txid: id, onchain: "confirmed", blockTime: time }),
        );
      }
    }
    commitments.sort((a, b) => a.seq - b.seq);
    return { genesis, commitments };
  }

  /** Reconstruct the ordered commitment log for one mission. */
  async getMissionLog(operatorAddress: string, missionId: string): Promise<Commitment[]> {
    const { commitments } = await this.scanAddress(operatorAddress);
    return commitments.filter((c) => c.missionId === missionId);
  }

  /** Reconstruct a Mission entity from its on-chain genesis payload. */
  async getMission(operatorAddress: string, missionId: string): Promise<Mission | null> {
    const { genesis } = await this.scanAddress(operatorAddress);
    const g = genesis.get(missionId);
    if (!g) return null;
    // Reconstructed from chain payloads alone; escrow details are re-derived when
    // the mission is loaded through the ledger. Default to the operator address.
    return missionFromGenesis({
      txid: g.txid,
      envelope: g.env,
      escrow: { escrowAddress: operatorAddress, mode: "simple", covenantId: null },
    });
  }
}
