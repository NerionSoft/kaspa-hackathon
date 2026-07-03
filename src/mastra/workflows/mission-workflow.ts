import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getLogger } from "@/infrastructure/logging/logger";
import { getLedger, sha256Hex } from "@/mission-ledger";
import { MissionSpec } from "@/mission-ledger/types";
import { plannerAgent } from "../agents/planner";
import { reconAgent } from "../agents/recon";
import { evaluateReservation, publishAndConfirm } from "../governance";
import { reason } from "../reason";
import { PlanTask, PlannerOutput, ReconOutput } from "../schemas";
import { plannerSeed, reconSeed } from "../seeds/mission";

/**
 * mission-workflow — the deterministic governance process for a mission.
 *
 * Open-ended reasoning is delegated to agents; every state transition is a governed,
 * on-ledger commitment. The invariants R1 (budget envelope), R2 (high-impact gate),
 * R3 (on-ledger ordering) are enforced HERE in code, never in prompts. Human gates
 * use the workflow's native suspend/resume.
 *
 * Step-3 slice: createMission → plan (planner) → recon (reserve → run → proof → handoff),
 * with the R1 budget gate wired via suspend/resume. Scanner onward lands in step 6.
 */

const logger = getLogger("MissionWorkflow");

const WorkflowInput = z.object({ spec: MissionSpec });
const WithSpec = z.object({ missionId: z.string(), spec: MissionSpec });
const WithPlan = WithSpec.extend({ tasks: z.array(PlanTask) });
const WorkflowOutput = z.object({
  missionId: z.string(),
  recon: ReconOutput,
  reasoningSource: z.string(),
});

function plannerPrompt(spec: z.infer<typeof MissionSpec>): string {
  return [
    `Mission objective: ${spec.objective}`,
    `Authorized target: ${spec.target}`,
    `Total budget: ${spec.budgetKas} KAS`,
    `Policy: per-agent cap ${spec.policy.perAgentBudgetCapKas} KAS, ` +
      `approval threshold ${spec.policy.humanApprovalThresholdKas} KAS.`,
    `Produce the ordered, budgeted task plan.`,
  ].join("\n");
}

function reconPrompt(spec: z.infer<typeof MissionSpec>): string {
  return [
    `Authorized target: ${spec.target}`,
    `Mission objective: ${spec.objective}`,
    `Map the attack surface (passive only).`,
  ].join("\n");
}

// --- Step 1: create the mission on-chain (locks the budget) ----------------
const createMissionStep = createStep({
  id: "create-mission",
  inputSchema: WorkflowInput,
  outputSchema: WithSpec,
  execute: async ({ inputData }) => {
    const ledger = await getLedger();
    const { missionId } = await ledger.createMission(inputData.spec);
    logger.info("Mission created", { missionId, backend: ledger.backend });
    return { missionId, spec: inputData.spec };
  },
});

// --- Step 2: plan the mission (planner reasoning) --------------------------
const planStep = createStep({
  id: "plan-mission",
  inputSchema: WithSpec,
  outputSchema: WithPlan,
  execute: async ({ inputData }) => {
    const { missionId, spec } = inputData;
    const ledger = await getLedger();

    const { output: plan, source } = await reason({
      agent: plannerAgent,
      label: "planner",
      prompt: plannerPrompt(spec),
      schema: PlannerOutput,
      seed: plannerSeed,
    });

    // Planner spends nothing; it records the plan and hands off to recon.
    await publishAndConfirm(ledger, {
      missionId,
      type: "STEP_DONE",
      actor: "agent:planner",
      rationale: `Plan ready (${source}): ${plan.tasks.length} tasks, ${plan.reserveMarginKas} KAS reserve.`,
      body: { tasks: plan.tasks, reserveMarginKas: plan.reserveMarginKas },
    });
    await publishAndConfirm(ledger, {
      missionId,
      type: "HANDOFF",
      actor: "agent:planner",
      rationale: "Hand off to recon to begin the audit.",
      body: { to: "recon" },
    });

    return { missionId, spec, tasks: plan.tasks };
  },
});

// --- Step 3: recon (reserve → run → proof → handoff), with the R1 gate ------
const reconStep = createStep({
  id: "recon",
  inputSchema: WithPlan,
  outputSchema: WorkflowOutput,
  resumeSchema: z.object({ approved: z.boolean(), comment: z.string().optional() }),
  suspendSchema: z.object({
    kind: z.literal("budget_increase"),
    agentRole: z.string(),
    amountKas: z.number(),
    reason: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { missionId, spec, tasks } = inputData;
    const ledger = await getLedger();

    const reconTask = tasks.find((t) => t.assignedRole === "recon");
    const reservation = reconTask?.budgetCapKas ?? 0;

    // R1 — budget gate (only evaluated on the first pass, before any resume decision).
    if (!resumeData) {
      const budget = await ledger.getBudget(missionId);
      const decision = evaluateReservation(budget, spec.policy, reservation);
      if (decision.approvalRequired) {
        await publishAndConfirm(ledger, {
          missionId,
          type: "REQUEST_BUDGET",
          actor: "agent:recon",
          rationale:
            `Recon requests approval to reserve ${reservation} KAS ` +
            `(${decision.reasons.join("; ")}).`,
          body: { amountKas: reservation, reasons: decision.reasons },
        });
        logger.info("Suspending for budget approval (R1)", { missionId, reservation });
        return await suspend({
          kind: "budget_increase",
          agentRole: "recon",
          amountKas: reservation,
          reason: decision.reasons.join("; "),
        });
      }
    }

    // Human decided (resume path).
    if (resumeData) {
      if (!resumeData.approved) {
        await publishAndConfirm(ledger, {
          missionId,
          type: "APPROVAL",
          actor: "user:sam",
          rationale: `Operator DENIED recon's budget request. ${resumeData.comment ?? ""}`.trim(),
          body: { decision: "denied" },
        });
        throw new Error("recon budget request denied by operator — no auto-execution");
      }
      await publishAndConfirm(ledger, {
        missionId,
        type: "APPROVAL",
        actor: "user:sam",
        rationale:
          `Operator APPROVED recon's ${reservation} KAS reservation. ${resumeData.comment ?? ""}`.trim(),
        body: { decision: "approved", amountKas: reservation },
      });
    }

    // Claim + reserve (governed spend).
    await publishAndConfirm(ledger, {
      missionId,
      type: "CLAIM_TASK",
      actor: "agent:recon",
      rationale: `Recon claims: ${reconTask?.title ?? "attack-surface mapping"}`,
      body: { task: reconTask },
    });
    await publishAndConfirm(ledger, {
      missionId,
      type: "RESERVE_BUDGET",
      actor: "agent:recon",
      budgetDelta: -reservation,
      rationale: `Reserve ${reservation} KAS for scoped recon within policy.`,
    });

    // Open-ended reasoning (seeded by default; Venice when live).
    const { output: recon, source } = await reason({
      agent: reconAgent,
      label: "recon",
      prompt: reconPrompt(spec),
      schema: ReconOutput,
      seed: reconSeed,
    });

    const proofHash = sha256Hex(JSON.stringify(recon));
    await publishAndConfirm(ledger, {
      missionId,
      type: "PUBLISH_PROOF",
      actor: "agent:recon",
      proofHash,
      rationale: "Publish recon attack-surface map hash; full artifact stored off-chain.",
      body: { endpoints: recon.endpoints.length, entryPoints: recon.entryPoints.length },
    });
    await publishAndConfirm(ledger, {
      missionId,
      type: "HANDOFF",
      actor: "agent:recon",
      rationale: "Hand off the recon map to the scanner.",
      body: { to: "scanner" },
    });

    return { missionId, recon, reasoningSource: source };
  },
});

export const missionWorkflow = createWorkflow({
  id: "mission-workflow",
  inputSchema: WorkflowInput,
  outputSchema: WorkflowOutput,
})
  .then(createMissionStep)
  .then(planStep)
  .then(reconStep)
  .commit();

export { createMissionStep, planStep, reconStep };
