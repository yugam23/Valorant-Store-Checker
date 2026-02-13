/**
 * Store API Route
 *
 * Protected endpoint that returns the user's daily store and wallet balance.
 * Aggregates data from Riot Store API (user-specific) and Valorant-API (static).
 */

import { NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/session";
import { getStorefront, getWallet } from "@/lib/riot-store";
import { getWeaponSkins, getContentTiers, getSkinVideo } from "@/lib/valorant-api";
import { getCachedStore, setCachedStore } from "@/lib/store-cache";
import { refreshTokensWithCookies } from "@/lib/riot-auth";
import { StoreData, StoreItem, TIER_COLORS, DEFAULT_TIER_COLOR } from "@/types/store";
import { CURRENCY_IDS } from "@/types/riot";

/** Fetches storefront + wallet and hydrates into StoreData */
async function fetchAndHydrateStore(tokens: {
  accessToken: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
}): Promise<StoreData> {
  const [storefront, wallet] = await Promise.all([
    getStorefront(tokens as any),
    getWallet(tokens as any),
  ]);

  const [skins, tiers] = await Promise.all([
    getWeaponSkins(),
    getContentTiers(),
  ]);

  const findSkin = (uuid: string) => {
    const target = uuid.toLowerCase();
    return skins.find((s) =>
      s.uuid.toLowerCase() === target ||
      s.levels.some((l) => l.uuid.toLowerCase() === target) ||
      s.chromas.some((c) => c.uuid.toLowerCase() === target)
    );
  };

  const findTier = (uuid: string) =>
    tiers.find((t) => t.uuid.toLowerCase() === uuid.toLowerCase());

  // Hydrate Daily Store Items
  const dailyOfferIds = storefront.SkinsPanelLayout.SingleItemOffers;
  const storeOffers = storefront.SkinsPanelLayout.SingleItemStoreOffers;

  const dailyItems = dailyOfferIds.map((offerId): StoreItem | null => {
    const offer = storeOffers.find((o) => o.OfferID === offerId);
    if (!offer) return null;

    const reward = offer.Rewards.find((r) => r.ItemTypeID === "e7c63390-eda7-46e0-bb7a-a6abdacd2433");
    const skinUuid = reward?.ItemID;
    if (!skinUuid) return null;

    const skin = findSkin(skinUuid);
    const cost = offer.Cost[CURRENCY_IDS.VP] || 0;

    if (!skin) {
      return {
        uuid: skinUuid,
        displayName: "Unknown Skin",
        displayIcon: "",
        streamedVideo: null,
        wallpaper: null,
        cost,
        currencyId: CURRENCY_IDS.VP,
        tierUuid: null,
        tierName: null,
        tierColor: DEFAULT_TIER_COLOR,
        chromaCount: 0,
        levelCount: 0,
        assetPath: "",
      };
    }

    const tier = skin.contentTierUuid ? findTier(skin.contentTierUuid) : null;
    const tierColor = tier
      ? (TIER_COLORS[tier.displayName] || `#${tier.highlightColor.slice(0, 6)}`)
      : DEFAULT_TIER_COLOR;

    return {
      uuid: skin.uuid,
      displayName: skin.displayName,
      displayIcon: skin.levels?.[0]?.displayIcon || skin.displayIcon || "",
      streamedVideo: getSkinVideo(skin),
      wallpaper: skin.wallpaper,
      cost,
      currencyId: CURRENCY_IDS.VP,
      tierUuid: tier?.uuid || null,
      tierName: tier?.displayName || null,
      tierColor,
      chromaCount: skin.chromas.length,
      levelCount: skin.levels.length,
      assetPath: skin.assetPath,
    };
  }).filter((item): item is StoreItem => item !== null);

  // Hydrate Night Market Items (if active)
  let nightMarketData: StoreData['nightMarket'] = undefined;

  if (storefront.BonusStore?.BonusStoreOffers) {
    const nightMarketItems = storefront.BonusStore.BonusStoreOffers.map((bonusOffer) => {
      const offer = bonusOffer.Offer;
      const reward = offer.Rewards.find((r) => r.ItemTypeID === "e7c63390-eda7-46e0-bb7a-a6abdacd2433");
      const skinUuid = reward?.ItemID;
      if (!skinUuid) return null;

      const skin = findSkin(skinUuid);
      const basePrice = offer.Cost[CURRENCY_IDS.VP] || 0;
      const discountedPrice = bonusOffer.DiscountCosts[CURRENCY_IDS.VP] || 0;
      const discountPercent = bonusOffer.DiscountPercent;
      if (!skin) return null;

      const tier = skin.contentTierUuid ? findTier(skin.contentTierUuid) : null;
      const tierColor = tier
        ? (TIER_COLORS[tier.displayName] || `#${tier.highlightColor.slice(0, 6)}`)
        : DEFAULT_TIER_COLOR;

      return {
        uuid: skin.uuid,
        displayName: skin.displayName,
        displayIcon: skin.levels?.[0]?.displayIcon || skin.displayIcon || "",
        streamedVideo: getSkinVideo(skin),
        wallpaper: skin.wallpaper,
        basePrice,
        discountedPrice,
        discountPercent,
        currencyId: CURRENCY_IDS.VP,
        tierUuid: tier?.uuid || null,
        tierName: tier?.displayName || null,
        tierColor,
        chromaCount: skin.chromas.length,
        levelCount: skin.levels.length,
        assetPath: skin.assetPath,
        isSeen: bonusOffer.IsSeen,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    if (nightMarketItems.length > 0) {
      nightMarketData = {
        items: nightMarketItems,
        expiresAt: new Date(Date.now() + storefront.BonusStore.BonusStoreRemainingDurationInSeconds * 1000),
      };
    }
  }

  return {
    items: dailyItems,
    expiresAt: new Date(Date.now() + storefront.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds * 1000),
    wallet: {
      vp: wallet.Balances[CURRENCY_IDS.VP] || 0,
      rp: wallet.Balances[CURRENCY_IDS.RP] || 0,
      kc: wallet.Balances[CURRENCY_IDS.KC] || 0,
    },
    nightMarket: nightMarketData,
  };
}

export async function GET() {
  try {
    // 1. Verify Session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Try fetching fresh data from Riot API
    try {
      const storeData = await fetchAndHydrateStore(session);
      setCachedStore(session.puuid, storeData);
      return NextResponse.json(storeData);
    } catch (fetchError) {
      // Token likely expired — try refreshing with stored Riot cookies
      console.warn("[Store API] Fresh fetch failed, attempting token refresh:", fetchError);

      if (session.riotCookies) {
        const refreshResult = await refreshTokensWithCookies(session.riotCookies);

        if (refreshResult.success) {
          // Update session with fresh tokens
          await createSession({
            ...refreshResult.tokens,
            riotCookies: refreshResult.riotCookies,
          });

          // Retry the store fetch with fresh tokens
          try {
            const storeData = await fetchAndHydrateStore(refreshResult.tokens);
            setCachedStore(refreshResult.tokens.puuid, storeData);
            console.log("[Store API] Served fresh data after token refresh");
            return NextResponse.json(storeData);
          } catch (retryError) {
            console.warn("[Store API] Retry after refresh also failed:", retryError);
          }
        } else {
          console.warn("[Store API] Token refresh failed:", refreshResult.error);
        }
      }

      // Fall back to cache
      const cached = getCachedStore(session.puuid);
      if (cached) {
        console.log("[Store API] Serving cached store data");
        return NextResponse.json({ ...cached, fromCache: true });
      }

      // No cache available — return the error
      return NextResponse.json(
        { error: "Session expired. Please log in again to refresh your store." },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error("Store API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch store data" },
      { status: 500 }
    );
  }
}
