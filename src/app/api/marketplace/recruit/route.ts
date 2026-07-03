import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/infrastructure/http/api-handler";
import { getMarketplace } from "@/marketplace/service";

const RecruitInput = z.object({
  missionRequestId: z.string().min(1),
});

/**
 * POST /api/marketplace/recruit → match a mission to the best-fit team and
 * return a costed RecruitmentPlan. 404 if the mission request doesn't exist.
 */
export const POST = apiHandler(async (req) => {
  const { missionRequestId } = RecruitInput.parse(await req.json());

  const marketplace = getMarketplace();
  const mission = await marketplace.getMissionRequest(missionRequestId);
  if (!mission) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `mission request not found: ${missionRequestId}` } },
      { status: 404 },
    );
  }

  const plan = await marketplace.recruit(missionRequestId);
  return NextResponse.json({ plan });
});
