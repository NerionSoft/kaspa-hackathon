import { NextResponse } from "next/server";
import { apiHandler } from "@/infrastructure/http/api-handler";
import { getMarketplace } from "@/marketplace/service";

/** GET /api/marketplace/clients → the registered clients (demand side). */
export const GET = apiHandler(async () => {
  const clients = await getMarketplace().listClients();
  return NextResponse.json({ clients });
});
