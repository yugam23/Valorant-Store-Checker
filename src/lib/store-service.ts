/**
 * Store Data Fetching Service
 *
 * Handles server-side data fetching for the Store Page.
 * Isolates Riot API calls and data hydration logic.
 */

import { getStorefront, getWallet } from "@/lib/riot-store";
import { getWeaponSkins, getContentTiers, getSkinVideo, getBundleByUuid } from "@/lib/valorant-api";
import { getCachedStore, setCachedStore } from "@/lib/store-cache";
import { StoreData, StoreItem, BundleItem, TIER_COLORS, DEFAULT_TIER_COLOR } from "@/types/store";
import { CURRENCY_IDS, RiotStorefront, RiotWallet } from "@/types/riot";
import { createLogger } from "@/lib/logger";

const log = createLogger("Store Service");

const ITEM_TYPE_WEAPON_SKIN = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
const ITEM_TYPE_BUDDY = "dd3bf334-87f3-40bd-b043-682a57a8dc3a";
const ITEM_TYPE_PLAYER_CARD = "3f296c07-64c3-494c-923b-fe692a4fa1bd";
const ITEM_TYPE_SPRAY = "d5f120f8-ff8c-4571-a619-6040a92ab903";
const ITEM_TYPE_PLAYER_TITLE = "de7caa6b-adf7-4588-bbd1-143831e786c6";
const ITEM_TYPE_FLEX = "03a572de-4234-31ed-d344-ababa488f981";

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

/**
 * Fetch static data required for hydration (Skins, Tiers).
 * Can be cached heavily or fetched once per request context.
 */
export async function getStoreStaticData() {
  const [skins, tiers] = await Promise.all([
    getWeaponSkins(),
    getContentTiers(),
  ]);
  return { skins, tiers };
}

type StaticData = Awaited<ReturnType<typeof getStoreStaticData>>;

/** 
 * Helper to find skin in static data 
 */
function findSkin(uuid: string, skins: StaticData['skins']) {
  const target = uuid.toLowerCase();
  return skins.find((s) =>
    s.uuid.toLowerCase() === target ||
    s.levels.some((l) => l.uuid.toLowerCase() === target) ||
    s.chromas.some((c) => c.uuid.toLowerCase() === target)
  );
}

/** 
 * Helper to find tier in static data 
 */
function findTier(uuid: string, tiers: StaticData['tiers']) {
  return tiers.find((t) => t.uuid.toLowerCase() === uuid.toLowerCase());
}

/**
 * Hydrate Daily Store Items
 */
export async function hydrateDailyItems(
  storefront: RiotStorefront, 
  staticData: StaticData
): Promise<StoreItem[]> {
  const { skins, tiers } = staticData;
  const dailyOfferIds = storefront.SkinsPanelLayout.SingleItemOffers;
  const storeOffers = storefront.SkinsPanelLayout.SingleItemStoreOffers;

  return dailyOfferIds.map((offerId): StoreItem | null => {
    const offer = storeOffers.find((o) => o.OfferID === offerId);
    if (!offer) return null;

    const reward = offer.Rewards.find((r) => r.ItemTypeID === ITEM_TYPE_WEAPON_SKIN);
    const skinUuid = reward?.ItemID;
    if (!skinUuid) return null;

    const skin = findSkin(skinUuid, skins);
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

    const tier = skin.contentTierUuid ? findTier(skin.contentTierUuid, tiers) : null;
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
}

/**
 * Hydrate Night Market (if available)
 */
export async function hydrateNightMarket(
  storefront: RiotStorefront,
  staticData: StaticData
): Promise<StoreData['nightMarket']> {
  if (!storefront.BonusStore?.BonusStoreOffers) return undefined;

  const { skins, tiers } = staticData;
  
  const nightMarketItems = storefront.BonusStore.BonusStoreOffers.map((bonusOffer) => {
    const offer = bonusOffer.Offer;
    const reward = offer.Rewards.find((r) => r.ItemTypeID === ITEM_TYPE_WEAPON_SKIN);
    const skinUuid = reward?.ItemID;
    if (!skinUuid) return null;

    const skin = findSkin(skinUuid, skins);
    const basePrice = offer.Cost[CURRENCY_IDS.VP] || 0;
    const discountedPrice = bonusOffer.DiscountCosts[CURRENCY_IDS.VP] || 0;
    const discountPercent = bonusOffer.DiscountPercent;
    if (!skin) return null;

    const tier = skin.contentTierUuid ? findTier(skin.contentTierUuid, tiers) : null;
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
    return {
      items: nightMarketItems,
      expiresAt: new Date(Date.now() + storefront.BonusStore.BonusStoreRemainingDurationInSeconds * 1000),
    };
  }
  
  return undefined;
}

/**
 * Hydrate Featured Bundle (if available)
 */
export async function hydrateBundle(
  storefront: RiotStorefront,
  staticData: StaticData
): Promise<StoreData['bundle']> {
  if (!storefront.FeaturedBundle?.Bundle) return undefined;

  const { skins, tiers } = staticData;
  const featuredBundle = storefront.FeaturedBundle.Bundle;

  // Fetch bundle metadata from Valorant-API
  const bundleMetadata = await getBundleByUuid(featuredBundle.DataAssetID);

  // Hydrate bundle items
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
        const skin = findSkin(itemId, skins);
        if (!skin) return null;

        const tier = skin.contentTierUuid ? findTier(skin.contentTierUuid, tiers) : null;
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

        const endpointsToTry = endpoint
          ? [endpoint]
          : ["buddies/levels", "buddies", "playercards", "sprays", "playertitles", "flex"];

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
    const totalBasePrice = bundleItems.reduce((sum, item) => sum + item.basePrice, 0);
    const totalDiscountedPrice = bundleItems.reduce((sum, item) => sum + item.discountedPrice, 0);

    return {
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
  
  return undefined;
}

export { getStorefront, getWallet };
