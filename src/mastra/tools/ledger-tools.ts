import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getLedger } from "@/mission-ledger";

/**
 * The framework-agnostic Mission Ledger, exposed to agents as Mastra tools — the
 * adapter boundary (§2). Agents get READ-ONLY access so they can be budget-aware
 * (e.g. the scanner adapts scope to the remaining budget). All governance writes
 * (reservations, proofs, handoffs) are performed by the workflow, never by agents,
 * so no agent can move state or overspend on its own.
 */

export const getBudgetTool = createTool({
  id: "get-budget",
  description:
    "Read the current budget for a mission from the Kaspa Mission Ledger (KAS): " +
    "total authorized, spent, and remaining.",
  inputSchema: z.object({ missionId: z.string() }),
  outputSchema: z.object({
    budgetKas: z.number(),
    spentKas: z.number(),
    remainingKas: z.number(),
  }),
  execute: async ({ missionId }) => {
    const ledger = await getLedger();
    return ledger.getBudget(missionId);
  },
});

export const getMissionLogTool = createTool({
  id: "get-mission-log",
  description:
    "Read the ordered commitment log for a mission from the Kaspa Mission Ledger — " +
    "the on-chain audit trail of every agent and human action so far.",
  inputSchema: z.object({ missionId: z.string() }),
  outputSchema: z.object({
    commitments: z.array(
      z.object({
        seq: z.number(),
        type: z.string(),
        actor: z.string(),
        budgetDelta: z.number(),
        rationale: z.string(),
        onchain: z.string(),
      }),
    ),
  }),
  execute: async ({ missionId }) => {
    const ledger = await getLedger();
    const log = await ledger.getMissionLog(missionId);
    return {
      commitments: log.map((c) => ({
        seq: c.seq,
        type: c.type,
        actor: c.actor,
        budgetDelta: c.budgetDelta,
        rationale: c.rationale,
        onchain: c.onchain,
      })),
    };
  },
});

export const ledgerTools = { getBudget: getBudgetTool, getMissionLog: getMissionLogTool };
