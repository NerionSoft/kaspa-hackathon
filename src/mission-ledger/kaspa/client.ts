import { env } from "@/infrastructure/config/env";
import { getLogger } from "@/infrastructure/logging/logger";
import { LedgerConfigError, LedgerNetworkError } from "../errors";
import { loadKaspa, type KaspaSdk } from "./sdk";

const logger = getLogger("KaspaClient");

// BIP44 derivation path for Kaspa (coin type 111111), first receive address.
const KASPA_DERIVATION_PATH = "m/44'/111111'/0'/0/0";
// Self-send amount carrying each payload. Net cost is only the (tiny) fee.
const COMMITMENT_OUTPUT_KAS = "0.2";

type PrivateKey = InstanceType<KaspaSdk["PrivateKey"]>;
type RpcClient = InstanceType<KaspaSdk["RpcClient"]>;

async function retry<T>(label: string, fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      logger.warn(`${label} failed (attempt ${i + 1}/${attempts})`, {
        error: err instanceof Error ? err.message : String(err),
      });
      if (i < attempts - 1) await sleep(delayMs * (i + 1));
    }
  }
  throw new LedgerNetworkError(`${label} failed after ${attempts} attempts`, {
    cause: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Thin wrapper over the Kaspa WASM RPC client for the TESTNET Mission Ledger.
 * Owns the connection, the operator spending key, and payload-tx submission.
 * A single operator key funds and receives every commitment (self-sends).
 */
export class KaspaClient {
  private readonly kaspa: KaspaSdk;
  private readonly network: string;
  private rpc?: RpcClient;
  private _privateKey?: PrivateKey;
  private _address?: string;

  constructor() {
    this.kaspa = loadKaspa();
    this.network = env.kaspa.network;
  }

  /** The operator's kaspatest: address — where budget is held and commitments land. */
  get address(): string {
    if (!this._address) {
      this._address = this.privateKey.toKeypair().toAddress(this.network).toString();
    }
    return this._address;
  }

  /** The operator's x-only public key hex — the arbiter key for covenant escrows. */
  get xOnlyPublicKeyHex(): string {
    return this.privateKey.toPublicKey().toXOnlyPublicKey().toString();
  }

  /** The loaded SDK, for pure/offline covenant script construction. */
  get sdk(): KaspaSdk {
    return this.kaspa;
  }

  get networkId(): string {
    return this.network;
  }

  private get privateKey(): PrivateKey {
    if (this._privateKey) return this._privateKey;
    const { PrivateKey, Mnemonic, XPrv } = this.kaspa;

    if (env.kaspa.privateKey) {
      this._privateKey = new PrivateKey(env.kaspa.privateKey);
    } else if (env.kaspa.mnemonic) {
      const seed = new Mnemonic(env.kaspa.mnemonic).toSeed();
      this._privateKey = new XPrv(seed).derivePath(KASPA_DERIVATION_PATH).toPrivateKey();
    } else {
      throw new LedgerConfigError(
        "No Kaspa testnet key configured. Set KASPA_PRIVATE_KEY or KASPA_MNEMONIC in .env " +
          "(testnet only), then fund the derived address from the faucet.",
      );
    }
    return this._privateKey;
  }

  async connect(): Promise<RpcClient> {
    if (this.rpc) return this.rpc;
    const { RpcClient, Resolver } = this.kaspa;

    const rpc = env.kaspa.rpcUrl
      ? new RpcClient({ url: env.kaspa.rpcUrl, networkId: this.network })
      : new RpcClient({ resolver: new Resolver(), networkId: this.network });

    await retry("rpc.connect", async () => {
      await rpc.connect();
      const info = await rpc.getServerInfo();
      if (!info.isSynced) throw new Error("node not synced yet");
      if (!info.hasUtxoIndex) throw new Error("node has no utxo index");
    });

    logger.info("Connected to Kaspa testnet", { network: this.network, url: rpc.url });
    this.rpc = rpc;
    return rpc;
  }

  async disconnect(): Promise<void> {
    if (this.rpc) {
      await this.rpc.disconnect();
      this.rpc = undefined;
    }
  }

  /** Balance in KAS for the operator address. */
  async getBalanceKas(): Promise<number> {
    const rpc = await this.connect();
    const { sompiToKaspaStringWithSuffix } = this.kaspa;
    const { balance } = await rpc.getBalanceByAddress({ address: this.address });
    // balance is bigint sompi; format then strip the unit suffix.
    const s = sompiToKaspaStringWithSuffix(balance, this.network);
    return Number.parseFloat(s);
  }

  /**
   * Submit one transaction carrying `payload` (a self-send). Returns the txid.
   * Retries on transient RPC errors and waits for a spendable UTXO so that
   * back-to-back commitments don't race on the change output.
   */
  async submitPayload(payload: Uint8Array): Promise<string> {
    const { kaspaToSompi } = this.kaspa;
    const amount = kaspaToSompi(COMMITMENT_OUTPUT_KAS);
    if (amount === undefined) throw new LedgerConfigError("invalid commitment output amount");
    return this.buildAndSubmit("submitPayload", this.address, amount, payload);
  }

  /** Move `amountKas` KAS from the operator into the budget escrow address. Returns the txid. */
  async fundEscrow(escrowAddress: string, amountKas: number): Promise<string> {
    const { kaspaToSompi } = this.kaspa;
    const amount = kaspaToSompi(String(amountKas));
    if (amount === undefined) throw new LedgerConfigError("invalid escrow amount");
    return this.buildAndSubmit("fundEscrow", escrowAddress, amount);
  }

  /**
   * Release a covenant P2SH escrow: spend its UTXO with an arbiter (operator)
   * signature back to `refundAddress`. This is the covenant settlement path — a
   * standard P2SH spend where the input carries its live UTXO (value + scriptPubKey)
   * so the sighash can be computed, and the signature is wrapped by the redeem script.
   * Returns the release txid.
   */
  async releaseEscrow(
    escrowAddress: string,
    redeemScriptHex: string,
    refundAddress: string,
    opts: { txVersion?: number; sigOpCount?: number } = {},
  ): Promise<string> {
    return retry("releaseEscrow", () =>
      this.releaseEscrowRaw(escrowAddress, redeemScriptHex, refundAddress, opts),
    );
  }

  /** Single-attempt release build+submit (throws the raw RPC error — used for diagnostics). */
  async releaseEscrowRaw(
    escrowAddress: string,
    redeemScriptHex: string,
    refundAddress: string,
    opts: { txVersion?: number; sigOpCount?: number } = {},
  ): Promise<string> {
    const rpc = await this.connect();
    const {
      Transaction, TransactionInput, TransactionOutput,
      payToAddressScript, createInputSignature, payToScriptHashSignatureScript,
    } = this.kaspa;
    const txVersion = opts.txVersion ?? 0;
    const sigOpCount = opts.sigOpCount ?? 1;

    const { entries } = await rpc.getUtxosByAddresses([escrowAddress]);
    if (!entries.length) {
      throw new LedgerNetworkError(`no escrow UTXO to release at ${escrowAddress}`, { escrowAddress });
    }
    const total = entries.reduce((s, e) => s + e.amount, 0n);
    // Post-Toccata compute mass for a P2SH checksig spend needs ~165900 sompi;
    // 0.003 KAS gives comfortable margin (storage mass + per-input scaling).
    const FEE = 300_000n;
    if (total <= FEE) throw new LedgerNetworkError("escrow balance below the settlement fee");

    const inputs = entries.map(
      (e) =>
        new TransactionInput({
          previousOutpoint: e.outpoint,
          signatureScript: "",
          sequence: 0n,
          sigOpCount,
          utxo: e, // gives createInputSignature the value + scriptPublicKey for the sighash
        }),
    );
    const tx = new Transaction({
      version: txVersion,
      inputs,
      outputs: [new TransactionOutput(total - FEE, payToAddressScript(refundAddress))],
      lockTime: 0n,
      gas: 0n,
      payload: "",
      subnetworkId: "0000000000000000000000000000000000000000",
    });

    // Sign each covenant input with the arbiter key and wrap it in the redeem script.
    for (let i = 0; i < inputs.length; i++) {
      const sig = createInputSignature(tx, i, this.privateKey);
      tx.inputs[i].signatureScript = payToScriptHashSignatureScript(redeemScriptHex, sig);
    }

    const res = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
    logger.info("Covenant escrow released", { escrowAddress, txid: res.transactionId });
    return res.transactionId;
  }

  private async buildAndSubmit(
    label: string,
    toAddress: string,
    amountSompi: bigint,
    payload?: Uint8Array,
  ): Promise<string> {
    const rpc = await this.connect();
    const { createTransactions } = this.kaspa;

    return retry(label, async () => {
      const entries = await this.spendableEntries();

      const { transactions } = await createTransactions({
        entries,
        outputs: [{ address: toAddress, amount: amountSompi }],
        changeAddress: this.address,
        priorityFee: 0n,
        networkId: this.network,
        ...(payload ? { payload } : {}),
      });

      let txid = "";
      for (const pending of transactions) {
        pending.sign([this.privateKey]);
        txid = await pending.submit(rpc);
      }
      if (!txid) throw new Error("transaction produced no txid");
      logger.info(`${label} tx submitted`, { txid });
      return txid;
    });
  }

  /** Fetch UTXOs, polling briefly until at least one spendable entry exists. */
  private async spendableEntries() {
    const rpc = await this.connect();
    for (let i = 0; i < 8; i++) {
      const { entries } = await rpc.getUtxosByAddresses([this.address]);
      if (entries.length > 0) {
        // basic largest-last ordering, mirroring the SDK examples
        entries.sort((a, b) => (a.amount > b.amount ? 1 : -1));
        return entries;
      }
      await sleep(1000);
    }
    throw new LedgerNetworkError(
      `No spendable UTXOs for ${this.address}. Fund it from the testnet faucet ` +
        `(https://faucet-tn10.kaspanet.io) and retry.`,
      { address: this.address },
    );
  }
}
