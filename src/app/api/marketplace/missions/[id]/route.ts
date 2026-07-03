import { NextResponse } from "next/server";
import { apiHandler } from "@/infrastructure/http/api-handler";
import { getMarketplace } from "@/marketplace/service";

/** GET /api/marketplace/missions/[id] → a mission request, 404 if missing. */
export const GET = apiHandler(async (_req, context) => {
  const { id } = await (context!.params as Promise<{ id: string }>);
  const mission = await getMarketplace().getMissionRequest(id);

  if (!mission) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `mission request not found: ${id}` } },
      { status: 404 },
    );
  }

  return NextResponse.json({ mission });
});
