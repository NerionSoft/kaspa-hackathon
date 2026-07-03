import { Agent } from "@mastra/core/agent";
import { veniceModel } from "../model";
import { REPORT_PROMPT } from "../prompts/report";
import { ledgerTools } from "../tools/ledger-tools";

/**
 * Report Generator — synthesizes the mission deliverable (a Markdown security-audit
 * report) from the recon map and findings, citing the on-chain governance trail.
 */
export const reportAgent = new Agent({
  id: "report_generator",
  name: "Report Generator",
  instructions: REPORT_PROMPT,
  model: veniceModel(),
  tools: ledgerTools,
});
