/**
 * Inventory API Route
 *
 * Protected endpoint that returns the user's owned weapon skins collection.
 * Fetches entitlements from Riot PD API and hydrates with Valorant-API data.
 */

import { NextResponse } from "next/server";
import { getSessionWithRefresh } from "@/lib/session";
import { getOwnedSkins } from "@/lib/riot-inventory";
import { getCachedInventory } from "@/lib/inventory-cache";
import { createLogger } from "@/lib/logger";

const log = createLogger("Inventory API");

export async function GET() {
  try {
    // 1. Get session with automatic token refresh
    const session = await getSessionWithRefresh();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 2. Fetch owned skins
    try {
      const inventoryData = await getOwnedSkins(session);

      return NextResponse.json(
        { ...inventoryData, fromCache: false },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          },
        }
      );
    } catch (fetchError) {
      log.warn("Inventory fetch failed:", fetchError);

      // Fall back to cache
      const cached = getCachedInventory(session.puuid);
      if (cached) {
        log.info("Serving cached inventory data");
        return NextResponse.json(
          { ...cached, fromCache: true },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          }
        );
      }

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
