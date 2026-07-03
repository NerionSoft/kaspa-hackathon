import { z } from "zod";
import {
  Actor,
  AgentRole,
  AgentStatus,
  ApprovalKind,
  ApprovalStatus,
  ArtifactKind,
  CommitmentType,
  FindingStatus,
  MissionStatus,
  OnchainStatus,
  Severity,
  TaskStatus,
} from "./enums";

/**
 * Business entities (§3). Monetary amounts are expressed in KAS at the domain
 * boundary (the Kaspa layer converts to/from sompi). The `Commitment` records
 * are an index of on-chain transactions — the chain is the source of truth.
 */

// A sha256 hex digest (64 lowercase hex chars) anchoring an off-chain artifact.
export const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "expected a sha256 hex digest");
export const Txid = z.string().regex(/^[0-9a-f]{64}$/, "expected a Kaspa txid (hex)");
export const IsoTimestamp = z.iso.datetime();

// --- Mission ---------------------------------------------------------------
export const Mission = z.object({
  id: z.string().min(1), // derived from the on-chain creation txid
  title: z.string().min(1),
  objective: z.string().min(1),
  rules: z.string().min(1), // human-readable governance policy summary
  budgetKas: z.number().nonnegative(),
  spentKas: z.number().nonnegative(),
  status: MissionStatus,
  createdBy: Actor,
  createTxid: Txid,
  budgetAddress: z.string().min(1), // address where the budget is locked (escrow)
  // How the budget is held: "covenant" = covenant-governed P2SH escrow on Kaspa;
  // "simple" = code-enforced escrow at an app-controlled address (documented fallback).
  escrowMode: z.enum(["covenant", "simple"]).default("simple"),
  covenantId: z.string().nullable().default(null), // KIP-20 lineage id, when covenant mode
  target: z.string().min(1), // authorized audit target (allow-listed)
  createdAt: IsoTimestamp,
});
export type Mission = z.infer<typeof Mission>;

// --- Policy (the "playbook": what is allowed without a human) --------------
export const Policy = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  perAgentBudgetCapKas: z.number().nonnegative(),
  humanApprovalThresholdKas: z.number().nonnegative(),
  highImpactActions: z.array(z.string()).default([]),
});
export type Policy = z.infer<typeof Policy>;

// --- Agent (fleet member) --------------------------------------------------
export const Agent = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  role: AgentRole,
  status: AgentStatus,
  currentTaskId: z.string().nullable().default(null),
  reservedKas: z.number().nonnegative().default(0),
});
export type Agent = z.infer<typeof Agent>;

// --- Task ------------------------------------------------------------------
export const Task = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  title: z.string().min(1),
  assignedRole: AgentRole,
  budgetCapKas: z.number().nonnegative(),
  status: TaskStatus,
  seq: z.number().int().nonnegative(), // ordering within the plan
});
export type Task = z.infer<typeof Task>;

// --- Commitment (ONE row = ONE Kaspa payload transaction) ------------------
export const Commitment = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  seq: z.number().int().nonnegative(), // monotonic per-mission sequence
  prev: z.string().nullable(), // id of the previous commitment (logical chain)
  type: CommitmentType,
  actor: Actor,
  budgetDelta: z.number(), // KAS; negative = consumed
  proofHash: Sha256Hex.nullable().default(null), // hash of the off-chain artifact
  rationale: z.string().min(1), // MANDATORY human-readable justification
  payload: z.record(z.string(), z.unknown()), // compact JSON actually written to the tx
  txid: Txid.nullable().default(null),
  blockTime: IsoTimestamp.nullable().default(null),
  onchain: OnchainStatus,
});
export type Commitment = z.infer<typeof Commitment>;

// --- ApprovalRequest (the human gate: budget OR high-impact action) --------
export const ApprovalRequest = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  agentRole: AgentRole,
  kind: ApprovalKind,
  amountKas: z.number().nonnegative().nullable().default(null), // budget_increase
  actionType: z.string().nullable().default(null), // high_impact_action, e.g. "active_exploit"
  target: z.string().nullable().default(null), // high_impact_action target
  reason: z.string().min(1),
  status: ApprovalStatus,
  decidedBy: Actor.nullable().default(null),
  decidedAt: IsoTimestamp.nullable().default(null),
  decisionTxid: Txid.nullable().default(null), // null until decided — NOTHING proceeds while null
  comment: z.string().nullable().default(null),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequest>;

// --- Finding (cyber domain) ------------------------------------------------
export const Finding = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  agentRole: AgentRole,
  severity: Severity,
  title: z.string().min(1),
  evidence: z.string().min(1),
  owaspRef: z.string().min(1), // e.g. "A03:2021-Injection"
  proofHash: Sha256Hex.nullable().default(null),
  status: FindingStatus,
});
export type Finding = z.infer<typeof Finding>;

// --- Artifact (proof stored off-chain, anchored on-chain by its hash) ------
export const Artifact = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  agentRole: AgentRole,
  kind: ArtifactKind,
  contentRef: z.string().min(1), // path/reference to off-chain content
  hash: Sha256Hex,
  txid: Txid.nullable().default(null),
});
export type Artifact = z.infer<typeof Artifact>;
