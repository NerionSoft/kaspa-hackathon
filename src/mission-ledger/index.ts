import { env } from "@/infrastructure/config/env";
import { getLogger } from "@/infrastructure/logging/logger";
import { MockLedger } from "./mock/mock-ledger";
import { LedgerIndex } from "./store/ledger-index";
import type { MissionLedger } from "./types";

export * from "./types";
export * from "./errors";
export {
  encodeEnvelope,
  encodeEnvelopeHex,
  tryDecodeEnvelope,
  sha256Hex,
  PROTOCOL_PREFIX,
  PROTOCOL_VERSION,
} from "./protocol";
export { MockLedger } from "./mock/mock-ledger";
export { LedgerIndex } from "./store/ledger-index";

const logger = getLogger("MissionLedger");

let singleton: MissionLedger | undefined;

/**
 * Construct the active MissionLedger from `LEDGER` env, backed by the durable
 * reconstructible {@link LedgerIndex}.
 *
 * `mock`  → deterministic, offline (default; demo-safe).
 * `kaspa` → real testnet commitments. The Kaspa backend is imported lazily so
 *           the WASM SDK is only loaded when actually selected (keeps `mock`
 *           runs, tests and the client bundle free of the native module).
 */
export async function createLedger(): Promise<MissionLedger> {
  const index = new LedgerIndex(env.db.ledgerUrl);
  await index.init();

  if (env.LEDGER === "kaspa") {
    const { KaspaLedger } = await import("./kaspa/kaspa-ledger");
    logger.info("Using Kaspa testnet ledger", { network: env.kaspa.network });
    return new KaspaLedger(index);
  }
  logger.info("Using in-memory mock ledger");
  return new MockLedger({ index });
}

/** Process-wide singleton ledger (mirrors the running server's view). */
export async function getLedger(): Promise<MissionLedger> {
  if (!singleton) singleton = await createLedger();
  return singleton;
}
