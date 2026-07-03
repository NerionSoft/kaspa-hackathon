import { z } from "zod";
import { Actor, CommitmentType, HUMAN_OPERATOR } from "@/domain/enums";
import type { Commitment, Mission } from "@/domain/entities";
import type { EscrowInfo } from "./escrow/types";

/**
 * The framework-agnostic Mission Ledger SDK contract.
 *
 * This is the universality boundary: agents (Mastra today, anything tomorrow)
 * only ever touch a mission through these operations. No governance logic lives
 * above this line. Two implementations exist — `KaspaLedger` (real testnet) and
 * `MockLedger` (in-memory, deterministic, offline) — selected by `LEDGER` env.
 */

// --- Inputs ----------------------------------------------------------------

export const PolicySpec = z.object({
  perAgentBudgetCapKas: z.number().nonnegative(),
  humanApprovalThresholdKas: z.number().nonnegative(),
  highImpactActions: z.array(z.string()).default([]),
});
export type PolicySpec = z.infer<typeof PolicySpec>;

export const MissionSpec = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  target: z.string().min(1), // authorized, allow-listed audit target
  budgetKas: z.number().positive(),
  rules: z.string().min(1),
  policy: PolicySpec,
  createdBy: Actor.default(HUMAN_OPERATOR),
});
export type MissionSpec = z.infer<typeof MissionSpec>;
/** Call-site shape (schema defaults are optional here). */
export type MissionSpecInput = z.input<typeof MissionSpec>;

export const CommitmentInput = z.object({
  missionId: z.string().min(1),
  type: CommitmentType,
  actor: Actor,
  budgetDelta: z.number().default(0), // KAS; negative = consumed, positive = granted
  rationale: z.string().min(1), // MANDATORY justification
  proofHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
  body: z.record(z.string(), z.unknown()).optional(), // structured extra payload
});
export type CommitmentInput = z.infer<typeof CommitmentInput>;
/** Call-site shape (budgetDelta defaults to 0, so it is optional here). */
export type CommitmentInputData = z.input<typeof CommitmentInput>;

export const SettlementPlan = z.object({
  outcome: z.enum(["completed", "aborted"]),
  // KAS paid out per agent role at settlement (informational for the fallback model).
  payouts: z.record(z.string(), z.number().nonnegative()).default({}),
  refundKas: z.number().nonnegative().default(0),
  rationale: z.string().min(1),
});
export type SettlementPlan = z.infer<typeof SettlementPlan>;
/** Call-site shape (schema defaults are optional here). */
export type SettlementPlanInput = z.input<typeof SettlementPlan>;

// --- Results ---------------------------------------------------------------

export interface BudgetView {
  budgetKas: number; // currently authorized envelope (initial + approved increases)
  spentKas: number; // total consumed
  remainingKas: number; // budgetKas - spentKas
}

export interface CreateMissionResult {
  missionId: string;
  txid: string;
}

export interface PublishResult {
  id: string;
  txid: string;
}

// --- The contract ----------------------------------------------------------

export interface MissionLedger {
  /** Which backend is active — surfaced in the UI so "real vs simulated" is never ambiguous. */
  readonly backend: "kaspa" | "mock";

  /** Create a mission: write the genesis tx (locking the budget) on-chain. */
  createMission(spec: MissionSpecInput): Promise<CreateMissionResult>;

  /** Publish one commitment as a payload transaction. */
  publishCommitment(input: CommitmentInputData): Promise<PublishResult>;

  /** Reconstruct the ordered commitment log for a mission (source of truth = chain). */
  getMissionLog(missionId: string): Promise<Commitment[]>;

  /** Current budget view, derived from the commitment log. */
  getBudget(missionId: string): Promise<BudgetView>;

  /** Fetch the mission entity (from its genesis payload). */
  getMission(missionId: string): Promise<Mission | null>;

  /** Escrow state (covenant lock/release txids) for the UI. */
  getEscrow(missionId: string): Promise<EscrowInfo | null>;

  /** List all missions known to this ledger. */
  listMissions(): Promise<Mission[]>;

  /** Settle the mission on-chain (payouts / refund / closure). */
  settle(missionId: string, plan: SettlementPlanInput): Promise<PublishResult>;

  /** Build a clickable explorer URL for a txid (empty string if not applicable). */
  explorerTxUrl(txid: string): string;
}
