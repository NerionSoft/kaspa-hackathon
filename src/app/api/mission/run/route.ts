import { NextResponse } from "next/server";
import { getLogger } from "@/infrastructure/logging/logger";
import { mastra } from "@/mastra";
import { referenceMissionSpec } from "@/mastra/seeds/mission";

export const dynamic = "force-dynamic";

const logger = getLogger("MissionRunAPI");

/**
 * Start a real mission: fires the Mastra `mission-workflow` (planner + recon on
 * Venice, governed by R1/R2/R3, publishing real Kaspa commitments) in the
 * background and returns immediately. Progress is streamed from the SSE endpoint
 * `/api/mission/latest/events`, which reads the same process-wide ledger index.
 */
export async function POST() {
  const workflow = mastra.getWorkflow("mission-workflow");
  const run = await workflow.createRun();

  // Fire-and-forget: the workflow runs for a while (real LLM + on-chain confirms).
  run
    .start({ inputData: { spec: referenceMissionSpec } })
    .then((r) => logger.info("Mission workflow finished", { runId: run.runId, status: r.status }))
    .catch((err) =>
      logger.error("Mission workflow failed", {
        runId: run.runId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

  return NextResponse.json({ started: true, runId: run.runId }, { status: 202 });
}
