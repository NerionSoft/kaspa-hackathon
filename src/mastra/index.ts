import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { env } from "@/infrastructure/config/env";
import { plannerAgent } from "./agents/planner";
import { reconAgent } from "./agents/recon";
import { missionWorkflow } from "./workflows/mission-workflow";

/**
 * The Mastra runtime for Kaspa Mission Control: the fleet agents, the governance
 * workflow, and durable workflow-state storage (LibSQL). Workflow snapshots persist
 * here so a suspended human gate survives restarts — the official HITL mechanism.
 */
export const mastra = new Mastra({
  agents: { planner: plannerAgent, recon: reconAgent },
  workflows: { "mission-workflow": missionWorkflow },
  storage: new LibSQLStore({ id: "mastra", url: env.db.mastraUrl }),
  logger: new PinoLogger({ name: "Mastra", level: env.isDev ? "info" : "warn" }),
});

export { missionWorkflow } from "./workflows/mission-workflow";
export { reconStep } from "./workflows/mission-workflow";
