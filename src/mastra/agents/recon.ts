import { Agent } from "@mastra/core/agent";
import { veniceModel } from "../model";
import { RECON_PROMPT } from "../prompts/recon";
import { ledgerTools } from "../tools/ledger-tools";

/**
 * Recon — maps the authorized target's attack surface (strictly passive).
 * Reasoning only: the workflow reserves budget, publishes the proof and hands off.
 */
export const reconAgent = new Agent({
  id: "recon",
  name: "Recon",
  instructions: RECON_PROMPT,
  model: veniceModel(),
  tools: ledgerTools,
});
