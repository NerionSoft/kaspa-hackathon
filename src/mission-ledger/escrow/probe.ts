import { getLogger } from "@/infrastructure/logging/logger";
import type { KaspaClient } from "../kaspa/client";
import { buildEscrowScript } from "./covenant-script";

const logger = getLogger("CovenantProbe");

export interface CovenantProbeResult {
  supported: boolean;
  reason: string;
}

/**
 * Decide, at runtime, whether covenant-governed escrow is usable on the connected
 * node. Covenants require a post-Toccata node (server version ≥ 2.0). We also build
 * a covenant-enabled script to confirm the SDK accepts covenant opcodes. If either
 * fails we fall back to the code-enforced escrow — the demo never breaks. (§4.4)
 */
export async function probeCovenants(client: KaspaClient): Promise<CovenantProbeResult> {
  // 1. The SDK must accept a covenant-enabled script (offline, cheap).
  try {
    buildEscrowScript(client.sdk, {
      arbiterXOnlyPubKeyHex: "00".repeat(32),
      network: client.networkId,
    });
  } catch (err) {
    return { supported: false, reason: `SDK rejected covenant script: ${errMsg(err)}` };
  }

  // 2. The node must be a Toccata build (covenants activated). Check server version.
  try {
    const rpc = await client.connect();
    const info = await rpc.getServerInfo();
    const major = Number.parseInt(info.serverVersion.split(".")[0] ?? "0", 10);
    if (Number.isNaN(major) || major < 2) {
      return { supported: false, reason: `node ${info.serverVersion} predates covenants (need ≥ 2.0)` };
    }
    logger.info("Covenants supported", { serverVersion: info.serverVersion });
    return { supported: true, reason: `node ${info.serverVersion} supports covenants` };
  } catch (err) {
    return { supported: false, reason: `could not verify node version: ${errMsg(err)}` };
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
