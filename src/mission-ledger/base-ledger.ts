import type { Commitment, Mission } from "@/domain/entities";
import type { OnchainStatus } from "@/domain/enums";
import {
  buildCommitmentEnvelope,
  buildGenesisEnvelope,
  commitmentFromEnvelope,
  commitmentId,
  computeBudget,
  deriveMissionStatus,
  missionFromGenesis,
  settlementCommitmentInput,
} from "./build";
import { MissionNotFoundError } from "./errors";
import { encodeEnvelope } from "./protocol";
import type { EscrowLock } from "./escrow/types";
import { CommitmentInput, MissionSpec, SettlementPlan } from "./types";
import type {
  BudgetView,
  CommitmentInputData,
  CreateMissionResult,
  MissionLedger,
  MissionSpecInput,
  PublishResult,
  SettlementPlanInput,
} from "./types";
import type { LedgerIndex } from "./store/ledger-index";

/**
 * Shared Mission Ledger behaviour, backed by the reconstructible {@link LedgerIndex}.
 *
 * Subclasses implement only the backend-specific seams:
 *  - {@link publishPayload}: write payload bytes (real Kaspa tx vs deterministic mock).
 *  - {@link lockBudget}: where/how the budget is held (covenant escrow vs simple address).
 *  - {@link reconcile}: refresh the index from the chain (no-op for the mock).
 *
 * Everything else — id/seq/prev chaining, budget math, mission status — lives here so
 * the two backends stay byte-for-byte consistent. The seq cursor is derived from the
 * index (rebuildable from chain), so the ledger holds no critical in-memory state.
 */
export abstract class BaseLedger implements MissionLedger {
  abstract readonly backend: "kaspa" | "mock";

  protected constructor(protected readonly index: LedgerIndex) {}

  /** Write payload bytes; return the txid and its initial on-chain status. */
  protected abstract publishPayload(bytes: Uint8Array): Promise<{
    txid: string;
    onchain: OnchainStatus;
  }>;

  /** Lock the mission budget; return where/how it is held (covenant escrow or fallback). */
  protected abstract lockBudget(missionId: string, budgetKas: number): Promise<EscrowLock>;

  /** Refresh the index for a mission from the chain. Default: nothing to do. */
  protected async reconcile(_missionId: string): Promise<void> {}

  abstract explorerTxUrl(txid: string): string;

  /** Clock seam so the mock can be made deterministic. */
  protected now(): number {
    return Date.now();
  }

  async createMission(spec: MissionSpecInput): Promise<CreateMissionResult> {
    const parsed = MissionSpec.parse(spec);
    const genesis = buildGenesisEnvelope(parsed, this.now());

    const { txid } = await this.publishPayload(encodeEnvelope(genesis));
    const missionId = txid;
    const escrow = await this.lockBudget(missionId, parsed.budgetKas);

    const mission = missionFromGenesis({
      txid,
      envelope: genesis,
      escrow: { escrowAddress: escrow.escrowAddress, mode: escrow.mode, covenantId: escrow.covenantId },
    });
    await this.index.upsertMission(mission);
    return { missionId, txid };
  }

  async publishCommitment(input: CommitmentInputData): Promise<PublishResult> {
    const parsed = CommitmentInput.parse(input);
    await this.requireMission(parsed.missionId);

    const maxSeq = await this.index.getMaxSeq(parsed.missionId);
    const seq = (maxSeq ?? -1) + 1;
    const prevId = seq === 0 ? null : commitmentId(parsed.missionId, seq - 1);
    const envelope = buildCommitmentEnvelope(parsed, seq, prevId);

    const { txid, onchain } = await this.publishPayload(encodeEnvelope(envelope));
    const commitment = commitmentFromEnvelope({
      envelope,
      txid,
      onchain,
      blockTime: onchain === "confirmed" ? new Date(this.now()).toISOString() : null,
    });

    await this.index.appendCommitment(commitment);
    await this.refreshMissionStatus(parsed.missionId);
    return { id: commitment.id, txid };
  }

  async getMissionLog(missionId: string): Promise<Commitment[]> {
    await this.requireMission(missionId);
    await this.reconcile(missionId);
    return this.index.getCommitments(missionId);
  }

  async getBudget(missionId: string): Promise<BudgetView> {
    const mission = await this.requireMission(missionId);
    const commitments = await this.index.getCommitments(missionId);
    return computeBudget(mission.budgetKas, commitments);
  }

  async getMission(missionId: string): Promise<Mission | null> {
    const mission = await this.index.getMission(missionId);
    if (!mission) return null;
    const commitments = await this.index.getCommitments(missionId);
    const budget = computeBudget(mission.budgetKas, commitments);
    return { ...mission, spentKas: budget.spentKas, status: deriveMissionStatus(commitments) };
  }

  async listMissions(): Promise<Mission[]> {
    const missions = await this.index.listMissions();
    return Promise.all(missions.map((m) => this.getMission(m.id) as Promise<Mission>));
  }

  async settle(missionId: string, plan: SettlementPlanInput): Promise<PublishResult> {
    const parsed = SettlementPlan.parse(plan);
    return this.publishCommitment(settlementCommitmentInput(missionId, parsed));
  }

  protected async requireMission(missionId: string): Promise<Mission> {
    const mission = await this.index.getMission(missionId);
    if (!mission) throw new MissionNotFoundError(missionId);
    return mission;
  }

  private async refreshMissionStatus(missionId: string): Promise<void> {
    const mission = await this.getMission(missionId);
    if (mission) await this.index.upsertMission(mission);
  }
}
