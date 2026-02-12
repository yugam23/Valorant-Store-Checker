/**
 * Store API Route
 *
 * Protected endpoint that returns the user's daily store and wallet balance.
 * Aggregates data from Riot Store API (user-specific) and Valorant-API (static).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStorefront, getWallet } from "@/lib/riot-store";
import { getWeaponSkins, getContentTiers } from "@/lib/valorant-api";
import { StoreData, StoreItem, NightMarketItem, TIER_COLORS, DEFAULT_TIER_COLOR } from "@/types/store";
import { CURRENCY_IDS } from "@/types/riot";

export async function GET() {
  try {
    // 1. Verify Session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch User Data (Parallel)
    const [storefront, wallet] = await Promise.all([
      getStorefront(session as any),
      getWallet(session as any),
    ]);

    // 3. Fetch Static Data
    // We fetch all skins/tiers because it's cached and fast
    const [skins, tiers] = await Promise.all([
      getWeaponSkins(),
      getContentTiers(),
    ]);

    // Helper to find skin by UUID (checking base, levels, and chromas)
    const findSkin = (uuid: string) => {
      const target = uuid.toLowerCase();
      return skins.find((s) => 
        s.uuid.toLowerCase() === target || 
        s.levels.some((l) => l.uuid.toLowerCase() === target) ||
        s.chromas.some((c) => c.uuid.toLowerCase() === target)
      );
    };

    // Helper to find tier
    const findTier = (uuid: string) => 
      tiers.find((t) => t.uuid.toLowerCase() === uuid.toLowerCase());

    // 4. Hydrate Daily Store Items
    // SingleItemOffers contains the OfferIDs visible in the store
    const dailyOfferIds = storefront.SkinsPanelLayout.SingleItemOffers;
    // SingleItemStoreOffers contains the price and reward details for those offers
    const storeOffers = storefront.SkinsPanelLayout.SingleItemStoreOffers;

    const dailyItems = dailyOfferIds.map((offerId): StoreItem | null => {
      // Find the offer details
      const offer = storeOffers.find((o) => o.OfferID === offerId);
      
      if (!offer) {
        return null;
      }

      // Extract Item ID (Skin UUID) from rewards
      // ItemTypeID for skins in V3 is e7c63390-eda7-46e0-bb7a-a6abdacd2433
      const reward = offer.Rewards.find((r) => r.ItemTypeID === "e7c63390-eda7-46e0-bb7a-a6abdacd2433");
      const skinUuid = reward?.ItemID;

      if (!skinUuid) {
        return null; // Not a skin offer?
      }

      const skin = findSkin(skinUuid);
      const cost = offer.Cost[CURRENCY_IDS.VP] || 0;

      if (!skin) {
        // Fallback if skin not found in static data
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
        streamedVideo: skin.levels?.[0]?.streamedVideo || null,
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

    // 5. Hydrate Night Market Items (if active)
    let nightMarketData: StoreData['nightMarket'] = undefined;

    if (storefront.BonusStore?.BonusStoreOffers) {
      const nightMarketItems = storefront.BonusStore.BonusStoreOffers.map((bonusOffer) => {
        const offer = bonusOffer.Offer;

        // Extract skin UUID from rewards
        const reward = offer.Rewards.find((r) => r.ItemTypeID === "e7c63390-eda7-46e0-bb7a-a6abdacd2433");
        const skinUuid = reward?.ItemID;

        if (!skinUuid) return null;

        const skin = findSkin(skinUuid);
        const basePrice = offer.Cost[CURRENCY_IDS.VP] || 0;
        const discountedPrice = bonusOffer.DiscountCosts[CURRENCY_IDS.VP] || 0;
        const discountPercent = bonusOffer.DiscountPercent;

        if (!skin) {
          return null;
        }

        const tier = skin.contentTierUuid ? findTier(skin.contentTierUuid) : null;
        const tierColor = tier
          ? (TIER_COLORS[tier.displayName] || `#${tier.highlightColor.slice(0, 6)}`)
          : DEFAULT_TIER_COLOR;

        return {
          uuid: skin.uuid,
          displayName: skin.displayName,
          displayIcon: skin.levels?.[0]?.displayIcon || skin.displayIcon || "",
          streamedVideo: skin.levels?.[0]?.streamedVideo || null,
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

    // 6. Construct Response
    const storeData: StoreData = {
      items: dailyItems,
      expiresAt: new Date(Date.now() + storefront.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds * 1000),
      wallet: {
        vp: wallet.Balances[CURRENCY_IDS.VP] || 0,
        rp: wallet.Balances[CURRENCY_IDS.RP] || 0,
        kc: wallet.Balances[CURRENCY_IDS.KC] || 0,
      },
      nightMarket: nightMarketData,
    };

    return NextResponse.json(storeData);

  } catch (error) {
    console.error("Store API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch store data" },
      { status: 500 }
    );
  }
}
