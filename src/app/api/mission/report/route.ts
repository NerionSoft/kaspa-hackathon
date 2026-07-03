import { NextResponse } from "next/server";
import { getLogger } from "@/infrastructure/logging/logger";
import { getLedger, sha256Hex } from "@/mission-ledger";
import { reportAgent } from "@/mastra/agents/report-generator";
import { isLive } from "@/mastra/model";
import { findingsSeed, reportSeed } from "@/mastra/seeds/mission";
import { getReport, setReport } from "@/mastra/report-store";

export const dynamic = "force-dynamic";

const logger = getLogger("MissionReportAPI");

/**
 * Generate the mission's audit report with the report_generator agent (real Venice
 * when AGENTS_MODE=live, else the deterministic seed), anchor its sha256 on-chain
 * via report_generator commitments (fire-and-forget), and return the Markdown.
 */
export async function POST() {
  const ledger = await getLedger();
  const missions = await ledger.listMissions();
  const mission = missions[0];
  if (!mission) return NextResponse.json({ error: "no mission" }, { status: 404 });

  const existing = getReport(mission.id);
  if (existing) return NextResponse.json(existing, { status: 200 });

  const findingsText = findingsSeed
    .map((f) => `- [${f.severity}] ${f.title} (${f.owaspRef}) — ${f.evidence}`)
    .join("\n");
  const prompt = [
    `Target: ${mission.target}`,
    `Objective: ${mission.objective}`,
    `Findings:\n${findingsText}`,
    `Write the Markdown audit report.`,
  ].join("\n\n");

  let markdown = reportSeed;
  let source: "venice" | "seed" = "seed";
  if (isLive()) {
    try {
      const res = await reportAgent.generate(prompt);
      const text = (res as { text?: string }).text?.trim();
      if (text && text.length > 40) {
        markdown = text;
        source = "venice";
      }
    } catch (err) {
      logger.warn("Report generation via Venice failed; using seed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const proofHash = sha256Hex(markdown);
  const report = { missionId: mission.id, markdown, source, proofHash, generatedAt: new Date().toISOString() };
  setReport(report);

  // Anchor the report on-chain via report_generator commitments (does not block the response).
  void (async () => {
    try {
      await ledger.publishCommitment({
        missionId: mission.id, type: "CLAIM_TASK", actor: "agent:report_generator",
        rationale: "Report generator claims the audit-report task.",
      });
      await ledger.publishCommitment({
        missionId: mission.id, type: "RESERVE_BUDGET", actor: "agent:report_generator",
        budgetDelta: -1, rationale: "Reserve 1 KAS to compile the audit report.",
      });
      await ledger.publishCommitment({
        missionId: mission.id, type: "PUBLISH_PROOF", actor: "agent:report_generator",
        proofHash, rationale: `Publish audit report (${source}); sha256 anchored, full report off-chain.`,
      });
      await ledger.publishCommitment({
        missionId: mission.id, type: "STEP_DONE", actor: "agent:report_generator",
        rationale: "Audit report ready.",
      });
      logger.info("Report anchored on-chain", { missionId: mission.id, proofHash });
    } catch (err) {
      logger.error("Anchoring report failed", { error: err instanceof Error ? err.message : String(err) });
    }
  })();

  return NextResponse.json(report, { status: 200 });
}
