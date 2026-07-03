import { getLogger } from "@/infrastructure/logging/logger";
import type { KaspaClient } from "../kaspa/client";
import { CovenantEscrow } from "./covenant-escrow";
import { probeCovenants } from "./probe";
import { SimpleEscrow } from "./simple-escrow";
import type { BudgetEscrow } from "./types";

export type { BudgetEscrow, EscrowLock, EscrowMode } from "./types";
export { CovenantEscrow } from "./covenant-escrow";
export { SimpleEscrow } from "./simple-escrow";
export { MockEscrow } from "./mock-escrow";
export { probeCovenants } from "./probe";

const logger = getLogger("Escrow");

/**
 * Pick the budget escrow for the Kaspa backend: covenant-governed if the node
 * supports it, otherwise the code-enforced fallback. Decided once at startup.
 */
export async function createKaspaEscrow(client: KaspaClient): Promise<BudgetEscrow> {
  const probe = await probeCovenants(client);
  if (probe.supported) {
    logger.info("Using covenant budget escrow", { reason: probe.reason });
    return new CovenantEscrow(client);
  }
  logger.warn("Falling back to code-enforced escrow", { reason: probe.reason });
  return new SimpleEscrow(client, probe.reason);
}
