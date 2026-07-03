import { NextResponse } from "next/server";
import { getLedger } from "@/mission-ledger";
import { getReport } from "@/mastra/report-store";

export const dynamic = "force-dynamic";

/** Return the latest mission's generated report (Markdown), or null. */
export async function GET() {
  const ledger = await getLedger();
  const missions = await ledger.listMissions();
  const mission = missions[0];
  if (!mission) return NextResponse.json({ report: null });
  return NextResponse.json({ report: getReport(mission.id) });
}
