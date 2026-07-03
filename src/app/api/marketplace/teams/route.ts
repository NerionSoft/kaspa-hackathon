import { NextResponse } from "next/server";
import { apiHandler } from "@/infrastructure/http/api-handler";
import { Domain } from "@/marketplace/contracts";
import { getMarketplace } from "@/marketplace/service";

/** GET /api/marketplace/teams?domain=… → registered teams, optionally filtered. */
export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const domainParam = url.searchParams.get("domain");
  const domain = domainParam === null ? undefined : Domain.parse(domainParam);

  const teams = await getMarketplace().listTeams({ domain });
  return NextResponse.json({ teams });
});
