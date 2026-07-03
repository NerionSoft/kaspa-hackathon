import { NextResponse } from "next/server";
import { getLogger } from "@/infrastructure/logging/logger";
import { getLedger } from "@/mission-ledger";

export const dynamic = "force-dynamic";

const logger = getLogger("MissionSettleAPI");

/**
 * Settle the latest mission. This releases the covenant budget escrow on-chain
 * (an arbiter-signed P2SH spend) and records a SETTLE commitment referencing the
 * release txid. Fire-and-forget: the on-chain release + confirmation take a few
 * seconds; the SSE feed surfaces the escrow `releaseTxid` and the SETTLE commitment.
 */
export async function POST() {
  const ledger = await getLedger();
  const missions = await ledger.listMissions();
  const latest = missions[0];
  if (!latest) return NextResponse.json({ error: "no mission to settle" }, { status: 404 });

  const budget = await ledger.getBudget(latest.id);
  ledger
    .settle(latest.id, {
      outcome: "completed",
      payouts: {},
      refundKas: budget.remainingKas,
      rationale: "Mission settled by operator; release the covenant escrow to the treasury.",
    })
    .then((r) => logger.info("Mission settled", { missionId: latest.id, settleTxid: r.txid }))
    .catch((err) =>
      logger.error("Settle failed", { error: err instanceof Error ? err.message : String(err) }),
    );

  return NextResponse.json({ settling: true, missionId: latest.id }, { status: 202 });
}
