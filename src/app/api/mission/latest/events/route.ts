import { getLogger } from "@/infrastructure/logging/logger";
import { getLedger } from "@/mission-ledger";

export const dynamic = "force-dynamic";

const logger = getLogger("MissionSSE");

/**
 * Server-Sent Events feed of the LATEST mission's on-chain activity. Every tick it
 * reads the process-wide ledger index (same singleton the workflow writes to),
 * emitting the mission, each new/updated commitment (with a clickable explorer URL
 * and pending→confirmed transitions), and the live budget. Single-operator demo:
 * "latest mission" is unambiguous.
 */
export async function GET(req: Request) {
  const ledger = await getLedger();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let missionId: string | null = null;
      const seen = new Map<string, string>(); // commitmentId -> onchain status last sent

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const tick = async () => {
        const missions = await ledger.listMissions();
        const latest = missions[0]; // index orders newest-first
        if (!latest) return;

        if (latest.id !== missionId) {
          missionId = latest.id;
          seen.clear();
          send("mission", { ...latest, backend: ledger.backend });
        } else {
          send("mission", { ...latest, backend: ledger.backend });
        }

        const log = await ledger.getMissionLog(missionId);
        for (const c of log) {
          if (seen.get(c.id) === c.onchain) continue; // unchanged
          seen.set(c.id, c.onchain);
          send("commitment", {
            ...c,
            explorerUrl: c.txid ? ledger.explorerTxUrl(c.txid) : null,
          });
        }

        const budget = await ledger.getBudget(missionId);
        send("budget", budget);

        const escrow = await ledger.getEscrow(missionId);
        if (escrow) send("escrow", escrow);
      };

      send("hello", { backend: ledger.backend });
      const interval = setInterval(() => {
        tick().catch((err) => logger.warn("SSE tick failed", { error: String(err) }));
      }, 1500);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
