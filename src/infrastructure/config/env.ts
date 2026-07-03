/**
 * Lazy-validated environment configuration for Kaspa Mission Control.
 *
 * Safety invariants enforced here (not in prompts, not in the UI):
 *  - The ledger is TESTNET ONLY. Any mainnet network id is rejected at load time.
 *  - Secrets (Kaspa key / mnemonic, Venice key) are read from env, never hardcoded.
 */

function optionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export type LedgerBackend = "mock" | "kaspa";

function buildEnv() {
  const NODE_ENV = process.env.NODE_ENV ?? "development";
  const isProduction = NODE_ENV === "production";

  const LEDGER = (optionalEnv("LEDGER") ?? "mock") as LedgerBackend;
  if (LEDGER !== "mock" && LEDGER !== "kaspa") {
    throw new Error(`Invalid LEDGER="${LEDGER}". Expected "mock" or "kaspa".`);
  }

  const KASPA_NETWORK = optionalEnv("KASPA_NETWORK") ?? "testnet-10";
  // Hard safety gate: refuse anything that is not a Kaspa testnet.
  if (!/^testnet-\d+$/.test(KASPA_NETWORK)) {
    throw new Error(
      `Refusing KASPA_NETWORK="${KASPA_NETWORK}". Kaspa Mission Control is TESTNET ONLY ` +
        `(e.g. "testnet-10"). Mainnet and real funds are never permitted.`,
    );
  }

  return {
    NODE_ENV,
    isProduction,
    isDev: !isProduction,
    LOG_LEVEL: optionalEnv("LOG_LEVEL"),

    LEDGER,

    kaspa: {
      network: KASPA_NETWORK,
      rpcUrl: optionalEnv("KASPA_RPC_URL"),
      privateKey: optionalEnv("KASPA_PRIVATE_KEY"),
      mnemonic: optionalEnv("KASPA_MNEMONIC"),
      restUrl: optionalEnv("KASPA_REST_URL") ?? "https://api-tn10.kaspa.org",
      explorerUrl: optionalEnv("KASPA_EXPLORER_URL") ?? "https://explorer-tn10.kaspa.org",
    },

    venice: {
      apiKey: optionalEnv("VENICE_API_KEY"),
      baseUrl: optionalEnv("VENICE_BASE_URL") ?? "https://api.venice.ai/api/v1",
      model: optionalEnv("VENICE_MODEL") ?? "venice-uncensored",
    },

    db: {
      ledgerUrl: optionalEnv("LEDGER_DB_URL") ?? "file:./.data/ledger.db",
      mastraUrl: optionalEnv("MASTRA_DB_URL") ?? "file:./.data/mastra.db",
    },

    appUrl: optionalEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  } as const;
}

type Env = ReturnType<typeof buildEnv>;

let _env: Env | undefined;

/** Lazy singleton — validates on first access, not at import time. */
export function getEnv(): Env {
  if (!_env) _env = buildEnv();
  return _env;
}

export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
