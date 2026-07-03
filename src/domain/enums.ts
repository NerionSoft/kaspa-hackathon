import { z } from "zod";

/**
 * Canonical enums for the Mission Control domain model (§3 of the brief).
 * These are the backbone of the mission FSM and the human-in-the-loop gates —
 * treat them as a contract. Values must match exactly across ledger, workflow and UI.
 */

export const MissionStatus = z.enum([
  "created",
  "planning",
  "in_progress",
  "review",
  "completed",
  "aborted",
]);
export type MissionStatus = z.infer<typeof MissionStatus>;

export const AgentRole = z.enum([
  "planner",
  "recon",
  "scanner",
  "exploit_validator",
  "report_generator",
]);
export type AgentRole = z.infer<typeof AgentRole>;

export const AGENT_ROLES = AgentRole.options;

export const AgentStatus = z.enum(["idle", "working", "waiting_approval", "done"]);
export type AgentStatus = z.infer<typeof AgentStatus>;

export const TaskStatus = z.enum([
  "queued",
  "claimed",
  "in_progress",
  "proof_published",
  "handed_off",
  "blocked",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

/**
 * Commitment types — one per kind of on-chain interaction. The confirmed
 * commitment set IS the audit trail; there is no separate audit log.
 */
export const CommitmentType = z.enum([
  "CLAIM_TASK",
  "RESERVE_BUDGET",
  "STEP_DONE",
  "REQUEST_BUDGET",
  "PUBLISH_PROOF",
  "HANDOFF",
  "APPROVAL",
  "SETTLE",
]);
export type CommitmentType = z.infer<typeof CommitmentType>;

export const OnchainStatus = z.enum(["pending", "confirmed", "failed"]);
export type OnchainStatus = z.infer<typeof OnchainStatus>;

export const ApprovalKind = z.enum(["budget_increase", "high_impact_action"]);
export type ApprovalKind = z.infer<typeof ApprovalKind>;

export const ApprovalStatus = z.enum(["pending_approval", "approved", "denied"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const Severity = z.enum(["info", "low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof Severity>;

export const FindingStatus = z.enum(["detected", "validated", "reported"]);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const ArtifactKind = z.enum(["recon", "scan", "poc", "report"]);
export type ArtifactKind = z.infer<typeof ArtifactKind>;

/**
 * Actor identity. Coordination is attributable: every commitment names who acted.
 * Either one of the fleet agents (`agent:<role>`) or the single human operator.
 */
export const HUMAN_OPERATOR = "user:sam" as const;

export const Actor = z.union([
  z.templateLiteral(["agent:", AgentRole]),
  z.literal(HUMAN_OPERATOR),
]);
export type Actor = z.infer<typeof Actor>;

export function agentActor(role: AgentRole): Actor {
  return `agent:${role}`;
}
