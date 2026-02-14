/**
 * Store API Route
 *
 * Protected endpoint that returns the user's daily store and wallet balance.
 * Aggregates data from Riot Store API (user-specific) and Valorant-API (static).
 */

import { NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/session";
import { getStorefront, getWallet } from "@/lib/riot-store";
import { getWeaponSkins, getContentTiers, getSkinVideo, getBundleByUuid } from "@/lib/valorant-api";
import { getCachedStore, setCachedStore } from "@/lib/store-cache";
import { refreshTokensWithCookies } from "@/lib/riot-auth";
import { StoreData, StoreItem, BundleData, BundleItem, TIER_COLORS, DEFAULT_TIER_COLOR } from "@/types/store";
import { CURRENCY_IDS } from "@/types/riot";
import { createLogger } from "@/lib/logger";

const log = createLogger("Store API");

/**
 * Riot's internal ItemTypeIDs for various item categories.
 */
const ITEM_TYPE_WEAPON_SKIN = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
const ITEM_TYPE_BUDDY = "dd3bf334-87f3-40bd-b043-682a57a8dc3a";
const ITEM_TYPE_PLAYER_CARD = "3f296c07-64c3-494c-923b-fe692a4fa1bd";
const ITEM_TYPE_SPRAY = "d5f120f8-ff8c-4571-a619-6040a92ab903";
const ITEM_TYPE_PLAYER_TITLE = "de7caa6b-adf7-4588-bbd1-143831e786c6";
const ITEM_TYPE_FLEX = "03a572de-4234-31ed-d344-ababa488f981";

/** Maps Riot ItemTypeID → human-readable category name */
function getItemTypeName(itemTypeId: string): string | null {
  switch (itemTypeId) {
    case ITEM_TYPE_WEAPON_SKIN: return "Skin";
    case ITEM_TYPE_BUDDY: return "Buddy";
    case ITEM_TYPE_PLAYER_CARD: return "Player Card";
    case ITEM_TYPE_SPRAY: return "Spray";
    case ITEM_TYPE_PLAYER_TITLE: return "Title";
    case ITEM_TYPE_FLEX: return "Flex";
    default: return null;
  }
}

/** Fetches storefront + wallet and hydrates into StoreData */
async function fetchAndHydrateStore(tokens: {
  accessToken: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
}): Promise<StoreData> {
  const [storefront, wallet] = await Promise.all([
    getStorefront(tokens),
    getWallet(tokens),
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

    const reward = offer.Rewards.find((r) => r.ItemTypeID === ITEM_TYPE_WEAPON_SKIN);
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
      const reward = offer.Rewards.find((r) => r.ItemTypeID === ITEM_TYPE_WEAPON_SKIN);
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

  // Hydrate Featured Bundle (if active)
  let bundleData: StoreData['bundle'] = undefined;

  if (storefront.FeaturedBundle?.Bundle) {
    const featuredBundle = storefront.FeaturedBundle.Bundle;

    // Fetch bundle metadata from Valorant-API
    const bundleMetadata = await getBundleByUuid(featuredBundle.DataAssetID);

    // Hydrate bundle items (supports ALL item types: skins, buddies, cards, sprays, titles)
    const bundleItems: BundleItem[] = (await Promise.all(
      featuredBundle.Items.map(async (item): Promise<BundleItem | null> => {
        const itemTypeId = item.Item.ItemTypeID;
        const itemId = item.Item.ItemID;
        const itemTypeName = getItemTypeName(itemTypeId) ?? "Unknown";

        let displayName = "Unknown Item";
        let displayIcon = "";
        let tierUuid: string | null = null;
        let tierName: string | null = null;
        let tierColor = DEFAULT_TIER_COLOR;

        if (itemTypeId === ITEM_TYPE_WEAPON_SKIN) {
          // ── Weapon Skin ──
          const skin = findSkin(itemId);
          if (!skin) return null;

          const tier = skin.contentTierUuid ? findTier(skin.contentTierUuid) : null;
          tierColor = tier
            ? (TIER_COLORS[tier.displayName] || `#${tier.highlightColor.slice(0, 6)}`)
            : DEFAULT_TIER_COLOR;
          tierUuid = tier?.uuid || null;
          tierName = tier?.displayName || null;
          displayName = skin.displayName;
          displayIcon = skin.levels?.[0]?.displayIcon || skin.displayIcon || "";
        } else {
          // ── Non-skin item: fetch from Valorant-API ──
          const endpointMap: Record<string, string> = {
            [ITEM_TYPE_BUDDY]: "buddies/levels",
            [ITEM_TYPE_PLAYER_CARD]: "playercards",
            [ITEM_TYPE_SPRAY]: "sprays",
            [ITEM_TYPE_PLAYER_TITLE]: "playertitles",
            [ITEM_TYPE_FLEX]: "flex",
          };
          const endpoint = endpointMap[itemTypeId];

          // For known types, try the mapped endpoint; for unknown types try all endpoints
          const endpointsToTry = endpoint
            ? [endpoint]
            : ["buddies/levels", "buddies", "playercards", "sprays", "playertitles", "flex"];

          if (!endpoint) {
            log.warn(`Unknown bundle item type: ${itemTypeId}, itemId: ${itemId} — trying all endpoints`);
          }

          for (const ep of endpointsToTry) {
            try {
              const res = await fetch(`https://valorant-api.com/v1/${ep}/${itemId}`);
              if (res.ok) {
                const json = await res.json();
                if (json.status === 200 && json.data) {
                  displayName = json.data.displayName || displayName;
                  displayIcon = json.data.displayIcon || json.data.largeArt || json.data.wideArt || "";
                  break;
                }
              }
            } catch {
              log.warn(`Failed to fetch ${itemTypeName} asset for ${itemId} via /${ep}`);
            }
          }
        }

        return {
          uuid: itemId,
          displayName,
          displayIcon,
          basePrice: item.BasePrice,
          discountedPrice: item.DiscountedPrice,
          discountPercent: item.DiscountPercent,
          currencyId: item.CurrencyID,
          tierUuid,
          tierName,
          tierColor,
          isPromoItem: item.IsPromoItem,
          itemType: itemTypeName,
        };
      })
    )).filter((item): item is BundleItem => item !== null);

    if (bundleItems.length > 0 && bundleMetadata) {
      // Calculate totals
      const totalBasePrice = bundleItems.reduce((sum, item) => sum + item.basePrice, 0);
      const totalDiscountedPrice = bundleItems.reduce((sum, item) => sum + item.discountedPrice, 0);

      bundleData = {
        bundleUuid: featuredBundle.ID,
        dataAssetID: featuredBundle.DataAssetID,
        displayName: bundleMetadata.displayName,
        displayIcon: bundleMetadata.displayIcon,
        displayIcon2: bundleMetadata.displayIcon2,
        items: bundleItems,
        totalBasePrice,
        totalDiscountedPrice,
        durationRemainingInSeconds: featuredBundle.DurationRemainingInSeconds,
        expiresAt: new Date(Date.now() + featuredBundle.DurationRemainingInSeconds * 1000),
        wholesaleOnly: featuredBundle.WholesaleOnly,
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
    bundle: bundleData,
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
      log.warn("Fresh fetch failed, attempting token refresh:", fetchError);

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
            log.info("Served fresh data after token refresh");
            return NextResponse.json(storeData);
          } catch (retryError) {
            log.warn("Retry after refresh also failed:", retryError);
          }
        } else {
          log.warn("Token refresh failed:", refreshResult.error);
        }
      }

      // Fall back to cache
      const cached = getCachedStore(session.puuid);
      if (cached) {
        log.info("Serving cached store data");
        return NextResponse.json({ ...cached, fromCache: true });
      }

      // No cache available — return the error
      return NextResponse.json(
        { error: "Session expired. Please log in again to refresh your store." },
        { status: 401 }
      );
    }

  } catch (error) {
    log.error("Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch store data" },
      { status: 500 }
    );
  }
}
