import { registerErrorMappings } from "@/infrastructure/http/api-handler";
import { ledgerErrorMappings } from "@/mission-ledger/errors";

/**
 * Server startup hook. Registers each module's domain-error → HTTP status mappings
 * so the generic apiHandler stays domain-agnostic.
 */
export function register() {
  registerErrorMappings(ledgerErrorMappings);
}
