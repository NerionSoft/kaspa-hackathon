import { Agent } from "@mastra/core/agent";
import { veniceModel } from "../model";
import { PLANNER_PROMPT } from "../prompts/planner";
import { ledgerTools } from "../tools/ledger-tools";

/**
 * Planner — decomposes the mission objective into an ordered, budgeted task plan.
 * Reasoning only: it publishes nothing itself; the workflow writes its commitments.
 */
export const plannerAgent = new Agent({
  id: "planner",
  name: "Planner",
  instructions: PLANNER_PROMPT,
  model: veniceModel(),
  tools: ledgerTools,
});
