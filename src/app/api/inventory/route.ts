/**
 * Inventory API Route
 *
 * Protected endpoint that returns the user's owned weapon skins collection.
 * Fetches entitlements from Riot PD API and hydrates with Valorant-API data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionWithRefresh } from "@/lib/session";
import { getOwnedSkins, clearInventoryCache } from "@/lib/riot-inventory";
import { getCachedInventory, clearCachedInventory } from "@/lib/inventory-cache";
import { createLogger } from "@/lib/logger";

const log = createLogger("Inventory API");

export async function GET(request: NextRequest) {
  try {
    // 1. Get session with automatic token refresh
    const session = await getSessionWithRefresh();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // If ?refresh=true, clear all caches to force a fresh fetch from Riot and Valorant-API
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    if (refresh) {
      clearInventoryCache(session.puuid);
      clearCachedInventory(session.puuid);
      // Note: Valorant-API static skin data is NOT cleared here — purchasing a skin
      // only changes *your entitlements*, not the global skin definitions list.
      log.info(`Inventory caches cleared for PUUID: ${session.puuid.substring(0, 8)} (manual refresh)`);
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
