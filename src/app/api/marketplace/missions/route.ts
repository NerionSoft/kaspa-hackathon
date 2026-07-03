import { NextResponse } from "next/server";
import { apiHandler } from "@/infrastructure/http/api-handler";
import { MissionRequestStatus, PostMissionInput } from "@/marketplace/contracts";
import { getMarketplace } from "@/marketplace/service";

/** GET /api/marketplace/missions?status=… → mission requests, optionally filtered. */
export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam === null ? undefined : MissionRequestStatus.parse(statusParam);

  const missions = await getMarketplace().listMissionRequests({ status });
  return NextResponse.json({ missions });
});

/** POST /api/marketplace/missions → create a mission request (201). */
export const POST = apiHandler(async (req) => {
  const input = PostMissionInput.parse(await req.json());
  const mission = await getMarketplace().postMission(input);
  return NextResponse.json({ mission }, { status: 201 });
});
