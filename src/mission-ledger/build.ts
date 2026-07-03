import { Commitment, Mission } from "@/domain/entities";
import type { MissionStatus } from "@/domain/enums";
import type { BudgetView, CommitmentInput, MissionSpec, SettlementPlan } from "./types";
import {
  CommitmentEnvelope,
  MissionGenesisEnvelope,
  PROTOCOL_VERSION,
} from "./protocol";

/**
 * Pure helpers shared by every MissionLedger implementation. They translate
 * between SDK inputs, the on-chain wire envelopes, and the domain entities that
 * index the chain — keeping the Kaspa and Mock backends byte-for-byte consistent.
 */

/** Deterministic commitment id scheme: `<missionId>:<seq>`. */
export function commitmentId(missionId: string, seq: number): string {
  return `${missionId}:${seq}`;
}

export function buildGenesisEnvelope(spec: MissionSpec, tsEpochMs: number): MissionGenesisEnvelope {
  return MissionGenesisEnvelope.parse({
    v: PROTOCOL_VERSION,
    k: "mission",
    title: spec.title,
    objective: spec.objective,
    target: spec.target,
    budgetKas: spec.budgetKas,
    rules: spec.rules,
    policy: {
      perAgentBudgetCapKas: spec.policy.perAgentBudgetCapKas,
      humanApprovalThresholdKas: spec.policy.humanApprovalThresholdKas,
      highImpactActions: spec.policy.highImpactActions,
    },
    createdBy: spec.createdBy,
    ts: tsEpochMs,
  });
}

/** How the budget is held — the subset of an EscrowLock the Mission entity records. */
export interface MissionEscrow {
  escrowAddress: string;
  mode: "covenant" | "simple";
  covenantId: string | null;
}

/** Reconstruct the Mission entity from its genesis envelope + escrow + on-chain facts. */
export function missionFromGenesis(args: {
  txid: string;
  envelope: MissionGenesisEnvelope;
  escrow: MissionEscrow;
  spentKas?: number;
  status?: MissionStatus;
}): Mission {
  const { txid, envelope, escrow } = args;
  return Mission.parse({
    id: txid,
    title: envelope.title,
    objective: envelope.objective,
    rules: envelope.rules,
    budgetKas: envelope.budgetKas,
    spentKas: args.spentKas ?? 0,
    status: args.status ?? "created",
    createdBy: envelope.createdBy,
    createTxid: txid,
    budgetAddress: escrow.escrowAddress,
    escrowMode: escrow.mode,
    covenantId: escrow.covenantId,
    target: envelope.target,
    createdAt: new Date(envelope.ts).toISOString(),
  });
}

export function buildCommitmentEnvelope(
  input: CommitmentInput,
  seq: number,
  prevId: string | null,
): CommitmentEnvelope {
  return CommitmentEnvelope.parse({
    v: PROTOCOL_VERSION,
    k: "commitment",
    m: input.missionId,
    t: input.type,
    a: input.actor,
    s: seq,
    p: prevId,
    d: input.budgetDelta,
    h: input.proofHash ?? null,
    r: input.rationale,
    ...(input.body ? { b: input.body } : {}),
  });
}

/** Reconstruct a Commitment index row from its envelope + on-chain facts. */
export function commitmentFromEnvelope(args: {
  envelope: CommitmentEnvelope;
  txid: string | null;
  onchain: Commitment["onchain"];
  blockTime?: string | null;
}): Commitment {
  const { envelope: e, txid, onchain } = args;
  return Commitment.parse({
    id: commitmentId(e.m, e.s),
    missionId: e.m,
    seq: e.s,
    prev: e.p,
    type: e.t,
    actor: e.a,
    budgetDelta: e.d,
    proofHash: e.h ?? null,
    rationale: e.r,
    payload: e,
    txid,
    blockTime: args.blockTime ?? null,
    onchain,
  });
}

/** Build the SETTLE commitment input that closes a mission. */
export function settlementCommitmentInput(
  missionId: string,
  plan: SettlementPlan,
): CommitmentInput {
  return {
    missionId,
    type: "SETTLE",
    actor: "user:sam",
    budgetDelta: 0,
    rationale: plan.rationale,
    body: {
      outcome: plan.outcome,
      payouts: plan.payouts,
      refundKas: plan.refundKas,
    },
  };
}

/**
 * Budget view derived purely from the (confirmed + pending) commitment log.
 * remaining = initial + Σ delta; increases are positive deltas, spend negative.
 */
export function computeBudget(initialBudgetKas: number, commitments: Commitment[]): BudgetView {
  let granted = 0;
  let spent = 0;
  for (const c of commitments) {
    if (c.budgetDelta > 0) granted += c.budgetDelta;
    else if (c.budgetDelta < 0) spent += -c.budgetDelta;
  }
  const budgetKas = round(initialBudgetKas + granted);
  const spentKas = round(spent);
  return { budgetKas, spentKas, remainingKas: round(budgetKas - spentKas) };
}

/** Infer coarse mission status from the commitment stream (refined by the workflow later). */
export function deriveMissionStatus(commitments: Commitment[]): MissionStatus {
  const settle = commitments.find((c) => c.type === "SETTLE");
  if (settle) {
    const outcome = (settle.payload as { b?: { outcome?: string } }).b?.outcome;
    return outcome === "aborted" ? "aborted" : "completed";
  }
  if (commitments.length === 0) return "created";
  const hasWork = commitments.some((c) => c.type !== "CLAIM_TASK");
  return hasWork ? "in_progress" : "planning";
}

function round(n: number): number {
  // KAS with 8 decimals of precision (sompi granularity) — avoid float drift.
  return Math.round(n * 1e8) / 1e8;
}
