import { NextResponse } from "next/server";
import { apiHandler } from "@/infrastructure/http/api-handler";
import { getMarketplace } from "@/marketplace/service";

/** GET /api/marketplace/roles → { roles, models } from the catalog. */
export const GET = apiHandler(async () => {
  const marketplace = getMarketplace();
  return NextResponse.json({
    roles: marketplace.listRoles(),
    models: marketplace.listModels(),
  });
});
