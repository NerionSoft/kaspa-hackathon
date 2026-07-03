import { NextResponse } from "next/server";
import { apiHandler } from "@/infrastructure/http/api-handler";
import { getMarketplace } from "@/marketplace/service";

/** GET /api/marketplace/teams/[id] → a team incl. reputation, 404 if missing. */
export const GET = apiHandler(async (_req, context) => {
  const { id } = await (context!.params as Promise<{ id: string }>);
  const team = await getMarketplace().getTeam(id);

  if (!team) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `team not found: ${id}` } },
      { status: 404 },
    );
  }

  return NextResponse.json({ team });
});
