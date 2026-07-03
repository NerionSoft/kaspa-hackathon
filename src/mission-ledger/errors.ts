import { DomainError } from "@/shared/errors/domain-error";
import type { ErrorHttpMapping } from "@/infrastructure/http/api-handler";

/** Base class for every Mission Ledger failure. */
export class LedgerError<T extends object = object> extends DomainError<T> {
  constructor(code: string, message: string, context?: T) {
    super(code, message, context, "mission-ledger");
  }
}

/** A required Kaspa credential / network setting is missing or invalid. */
export class LedgerConfigError extends LedgerError {
  constructor(message: string, context?: object) {
    super("LEDGER_CONFIG_ERROR", message, context);
  }
}

/** The Kaspa node/RPC/REST layer failed (network, timeout, not synced, no funds). */
export class LedgerNetworkError extends LedgerError {
  constructor(message: string, context?: object) {
    super("LEDGER_NETWORK_ERROR", message, context);
  }
}

/** A payload could not be encoded/decoded against the `mc` wire protocol. */
export class LedgerProtocolError extends LedgerError {
  constructor(message: string, context?: object) {
    super("LEDGER_PROTOCOL_ERROR", message, context);
  }
}

/** A referenced mission does not exist in the (reconstructible) index. */
export class MissionNotFoundError extends LedgerError<{ missionId: string }> {
  constructor(missionId: string) {
    super("MISSION_NOT_FOUND", `Mission not found: ${missionId}`, { missionId });
  }
}

/** Attempted spend/reservation exceeds the authorized on-chain envelope (invariant R1). */
export class BudgetExceededError extends LedgerError<{
  missionId: string;
  requestedKas: number;
  remainingKas: number;
}> {
  constructor(context: { missionId: string; requestedKas: number; remainingKas: number }) {
    super(
      "BUDGET_EXCEEDED",
      `Reservation of ${context.requestedKas} KAS exceeds remaining budget ` +
        `${context.remainingKas} KAS for mission ${context.missionId}`,
      context,
    );
  }
}

export const ledgerErrorMappings: ErrorHttpMapping = {
  LEDGER_CONFIG_ERROR: 500,
  LEDGER_NETWORK_ERROR: 502,
  LEDGER_PROTOCOL_ERROR: 422,
  MISSION_NOT_FOUND: 404,
  BUDGET_EXCEEDED: 409,
};
