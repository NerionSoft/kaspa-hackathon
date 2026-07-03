/**
 * Process-wide store for generated mission reports (the deliverable Markdown).
 * The report is large, so it is NOT put on-chain — only its sha256 is anchored via
 * a PUBLISH_PROOF commitment. This store serves the report to the UI.
 */
export interface MissionReport {
  missionId: string;
  markdown: string;
  source: "venice" | "seed";
  generatedAt: string;
  proofHash: string;
}

const reports = new Map<string, MissionReport>();

export function setReport(r: MissionReport): void {
  reports.set(r.missionId, r);
}
export function getReport(missionId: string): MissionReport | null {
  return reports.get(missionId) ?? null;
}
