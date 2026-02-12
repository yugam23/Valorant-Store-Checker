/**
 * Store API Route
 *
 * Proxy endpoint for fetching player store data from Riot API
 * and hydrating it with static assets from Valorant-API.com
 *
 * Security: Server-side only. Uses session cookies for authentication.
 * Never exposes Riot tokens to client.
 */

import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";
import { getPlayerStore, getWallet, getStoreResetTime } from "../../../lib/riot-api";
import {
  getWeaponSkinsByUuids,
  getContentTierByUuid,
} from "../../../lib/valorant-api";
import { CURRENCY_IDS } from "../../../types/riot";
import type { StoreData, StoreItem } from "../../../types/store";

/**
 * GET /api/store
 *
 * Fetches player's daily store with hydrated skin data
 *
 * Flow:
 * 1. Get session from cookie (401 if missing)
 * 2. Fetch store from Riot API
 * 3. Fetch static skin data from Valorant-API
 * 4. Hydrate store items with images, names, prices
 * 5. Return unified StoreData
 */
export async function GET() {
  try {
    // Step 1: Authenticate via session
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in." },
        { status: 401 }
      );
    }

    // Step 2: Fetch player store and wallet in parallel
    const [storeResult, walletResult] = await Promise.all([
      getPlayerStore(session),
      getWallet(session),
    ]);

    // Handle store fetch failure
    if (!storeResult.success) {
      const errorMsg = "error" in storeResult ? storeResult.error : "Unknown error";
      console.error("[Store API] Failed to fetch store:", errorMsg);
      return NextResponse.json(
        { error: errorMsg },
        { status: errorMsg.includes("Authentication") ? 401 : 500 }
      );
    }

    const storefront = storeResult.data;

    // Step 3: Extract skin UUIDs from daily offers
    const skinUuids = storefront.SkinsPanelLayout.SingleItemOffers;

    if (!skinUuids || skinUuids.length === 0) {
      return NextResponse.json(
        { error: "No items in store today" },
        { status: 404 }
      );
    }

    // Step 4: Fetch static skin data from Valorant-API
    const skinsMap = await getWeaponSkinsByUuids(skinUuids);

    // Step 5: Hydrate store items
    const items: StoreItem[] = [];

    for (const skinUuid of skinUuids) {
      const skinData = skinsMap.get(skinUuid.toLowerCase());

      if (!skinData) {
        console.warn(`[Store API] Skin not found in Valorant-API: ${skinUuid}`);
        continue; // Skip missing skins
      }

      // Get content tier (rarity) data
      let tierName: string | null = null;
      let tierColor = "#71717A"; // Default zinc-500

      if (skinData.contentTierUuid) {
        const tier = await getContentTierByUuid(skinData.contentTierUuid);
        if (tier) {
          tierName = tier.displayName;
          // Extract RGB from highlightColor (format: "edd65aff" -> "#edd65a")
          if (tier.highlightColor) {
            tierColor = `#${tier.highlightColor.substring(0, 6)}`;
          }
        }
      }

      // Get primary chroma (first variant) for images
      const primaryChroma = skinData.chromas[0];
      const primaryLevel = skinData.levels[0];

      // Build hydrated item
      const item: StoreItem = {
        uuid: skinData.uuid,
        displayName: skinData.displayName,
        displayIcon: primaryChroma?.fullRender || skinData.displayIcon || "",
        streamedVideo: primaryLevel?.streamedVideo || primaryChroma?.streamedVideo || null,
        wallpaper: skinData.wallpaper,
        cost: 0, // Will be set below
        currencyId: CURRENCY_IDS.VP,
        tierUuid: skinData.contentTierUuid,
        tierName,
        tierColor,
        chromaCount: skinData.chromas.length,
        levelCount: skinData.levels.length,
        assetPath: skinData.assetPath,
      };

      items.push(item);
    }

    // Step 6: Fetch prices from offers (not in SingleItemOffers, need to query offers endpoint)
    // For now, use placeholder pricing - will be fixed in next iteration
    // TODO: Fetch actual prices from /store/v2/offers endpoint
    items.forEach((item) => {
      item.cost = 1775; // Placeholder - typical skin price
    });

    // Step 7: Calculate store expiration
    const expiresAt = getStoreResetTime(
      storefront.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds
    );

    // Step 8: Build wallet data if available
    let walletBalance = undefined;
    if (walletResult.success) {
      const balances = walletResult.data.Balances;
      walletBalance = {
        vp: balances[CURRENCY_IDS.VP] || 0,
        rp: balances[CURRENCY_IDS.RP] || 0,
        kc: balances[CURRENCY_IDS.KC] || undefined,
      };
    }

    // Step 9: Return hydrated store data
    const response: StoreData = {
      items,
      expiresAt,
      wallet: walletBalance,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[Store API] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch store",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle other HTTP methods
 */
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
