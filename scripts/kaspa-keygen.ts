/**
 * Generate a fresh Kaspa TESTNET key + address for the Mission Ledger.
 *
 *   pnpm exec tsx scripts/kaspa-keygen.ts
 *
 * Prints a BIP39 mnemonic and the derived kaspatest: address. Put the mnemonic
 * in `.env` as KASPA_MNEMONIC, then fund the address from the testnet faucet:
 *   https://faucet.kaspanet.io
 *
 * TESTNET ONLY. These are throwaway credentials — never reuse on mainnet.
 */
import { loadKaspa } from "@/mission-ledger/kaspa/sdk";

const NETWORK = "testnet-10";
const PATH = "m/44'/111111'/0'/0/0";

function main() {
  const { Mnemonic, XPrv } = loadKaspa();

  const mnemonic = Mnemonic.random();
  const seed = mnemonic.toSeed();
  const privateKey = new XPrv(seed).derivePath(PATH).toPrivateKey();
  const address = privateKey.toKeypair().toAddress(NETWORK).toString();

  console.log("\n=== Kaspa TESTNET credentials (throwaway) ===\n");
  console.log("Mnemonic (add to .env as KASPA_MNEMONIC):");
  console.log(`  ${mnemonic.phrase}\n`);
  console.log(`Derivation path : ${PATH}`);
  console.log(`Address         : ${address}\n`);
  console.log("Next steps:");
  console.log("  1. Add to .env:  KASPA_MNEMONIC=\"<phrase above>\"  and  LEDGER=kaspa");
  console.log(`  2. Fund it:      https://faucet.kaspanet.io  (paste the address)`);
  console.log("  3. Verify:       pnpm hello:mission\n");
}

main();
