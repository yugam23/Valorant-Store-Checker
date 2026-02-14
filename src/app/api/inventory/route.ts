/**
 * Inventory API Route
 *
 * Protected endpoint that returns the user's owned weapon skins collection.
 * Fetches entitlements from Riot PD API and hydrates with Valorant-API data.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getOwnedSkins } from "@/lib/riot-inventory";
import { createLogger } from "@/lib/logger";

const log = createLogger("Inventory API");

export async function GET() {
  try {
    // 1. Verify Session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 2. Fetch owned skins
    try {
      const inventoryData = await getOwnedSkins(session);

      return NextResponse.json(inventoryData, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    } catch (fetchError) {
      log.error("Failed to fetch inventory:", fetchError);

      return NextResponse.json(
        {
          error: "Failed to fetch inventory data",
          code: "RIOT_API_ERROR",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error("Unhandled error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch inventory data",
        code: "UNKNOWN",
      },
      { status: 500 }
    );
  }
}
