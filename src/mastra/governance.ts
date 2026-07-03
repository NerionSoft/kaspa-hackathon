import { getLogger } from "@/infrastructure/logging/logger";
import type { BudgetView, CommitmentInputData, MissionLedger } from "@/mission-ledger/types";
import type { PolicySpec } from "@/mission-ledger/types";

/**
 * Hard-coded governance for the mission workflow — the invariants R1/R2/R3.
 *
 * These live in CODE, never in prompts. No matter what an agent's LLM output says,
 * the workflow enforces the budget envelope, the human gates, and on-ledger ordering.
 */

const logger = getLogger("Governance");

export interface ReservationDecision {
  approvalRequired: boolean;
  reasons: string[];
  requestedKas: number;
  remainingKas: number;
}

/**
 * R1 — Budget envelope. A reservation needs human approval if it would exceed the
 * remaining budget, the per-agent cap, or the policy's approval threshold. The
 * workflow must then force a REQUEST_BUDGET + suspend; it may never silently overspend.
 */
export function evaluateReservation(
  budget: BudgetView,
  policy: PolicySpec,
  requestedKas: number,
): ReservationDecision {
  const reasons: string[] = [];
  if (requestedKas > budget.remainingKas) reasons.push("exceeds remaining budget");
  if (requestedKas > policy.perAgentBudgetCapKas) reasons.push("exceeds per-agent cap");
  if (requestedKas > policy.humanApprovalThresholdKas) reasons.push("above approval threshold");
  return {
    approvalRequired: reasons.length > 0,
    reasons,
    requestedKas,
    remainingKas: budget.remainingKas,
  };
}

/**
 * R2 — High-impact action. Any action listed in the policy's highImpactActions forces
 * an ApprovalRequest + suspend, regardless of the LLM output.
 */
export function isHighImpact(policy: PolicySpec, actionType: string): boolean {
  return policy.highImpactActions.includes(actionType);
}

/**
 * R3 — On-ledger ordering. A transition does not "count" until its commitment is
 * confirmed on Kaspa. Publish, then wait for confirmation before proceeding.
 * (For the mock ledger this resolves immediately.)
 */
export async function publishAndConfirm(
  ledger: MissionLedger,
  input: CommitmentInputData,
  opts: { timeoutMs?: number } = {},
): Promise<{ id: string; txid: string; confirmed: boolean }> {
  const { id, txid } = await ledger.publishCommitment(input);
  const confirmed = await waitForConfirmation(ledger, input.missionId, id, opts.timeoutMs ?? 90_000);
  if (!confirmed) {
    logger.warn("Commitment not confirmed within timeout (R3)", { id, txid, type: input.type });
  }
  return { id, txid, confirmed };
}

async function waitForConfirmation(
  ledger: MissionLedger,
  missionId: string,
  commitmentId: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    const log = await ledger.getMissionLog(missionId);
    const c = log.find((x) => x.id === commitmentId);
    if (c?.onchain === "confirmed") return true;
    if (c?.onchain === "failed") return false;
    if (Date.now() >= deadline) break;
    await sleep(1500);
  } while (Date.now() < deadline);
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
