/**
 * Store Data Fetching Service
 *
 * Handles server-side data fetching for the Store Page.
 * Isolates Riot API calls and data hydration logic.
 */

import { getStorefront, getWallet, type StoreTokens } from "@/lib/riot-store";
import { getWeaponSkins, getContentTiers, getSkinVideo, getBundleByUuid, getSkinLevelByUuid, getBuddyLevelByUuid, getSprayByUuid, getPlayerCardByUuid, getPlayerTitleByUuid } from "@/lib/valorant-api";
import { StoreData, StoreItem, BundleItem, BundleData, TIER_COLORS, DEFAULT_TIER_COLOR } from "@/types/store";
import { RiotStorefront, RiotBundle } from "@/types/riot";
import { ITEM_TYPE_WEAPON_SKIN, ITEM_TYPE_BUDDY, ITEM_TYPE_PLAYER_CARD, ITEM_TYPE_SPRAY, ITEM_TYPE_PLAYER_TITLE, ITEM_TYPE_FLEX, CURRENCY_IDS } from "@/lib/constants";
import { createLogger } from "@/lib/logger";

const log = createLogger("Store Service");

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
export async function fetchStoreStaticData() {
  const [skins, tiers] = await Promise.all([
    getWeaponSkins(),
    getContentTiers(),
  ]);
  return { skins, tiers };
}


type StaticData = Awaited<ReturnType<typeof fetchStoreStaticData>>;

/** Exported type alias for use in Server Component props */
export type { StaticData as StoreStaticData };

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
 * Hydrate a single bundle from the Riot storefront response.
 * Gracefully handles bundles/items not yet indexed by valorant-api.com.
 */
async function hydrateSingleBundle(
  rawBundle: RiotBundle,
  staticData: StaticData
): Promise<BundleData | null> {
  const { skins, tiers } = staticData;

  // Fetch bundle metadata from Valorant-API (may return null for new bundles)
  const bundleMetadata = await getBundleByUuid(rawBundle.DataAssetID);
  if (!bundleMetadata) {
    log.warn("Bundle %s not found in valorant-api.com — using fallback display data", rawBundle.DataAssetID);
  }

  // Hydrate bundle items
  const bundleItems: BundleItem[] = (await Promise.all(
    rawBundle.Items.map(async (item): Promise<BundleItem | null> => {
      const itemTypeId = item.Item.ItemTypeID;
      const itemId = item.Item.ItemID;
      const itemTypeName = getItemTypeName(itemTypeId) ?? "Unknown";

      let displayName = itemTypeName !== "Unknown" ? `New ${itemTypeName}` : "Unknown Item";
      let displayIcon = "";
      let tierUuid: string | null = null;
      let tierName: string | null = null;
      let tierColor = DEFAULT_TIER_COLOR;

      if (itemTypeId === ITEM_TYPE_WEAPON_SKIN) {
        // ── Weapon Skin ──
        const skin = findSkin(itemId, skins);
        if (skin) {
          const tier = skin.contentTierUuid ? findTier(skin.contentTierUuid, tiers) : null;
          tierColor = tier
            ? (TIER_COLORS[tier.displayName] || `#${tier.highlightColor.slice(0, 6)}`)
            : DEFAULT_TIER_COLOR;
          tierUuid = tier?.uuid || null;
          tierName = tier?.displayName || null;
          displayName = skin.displayName;
          displayIcon = skin.levels?.[0]?.displayIcon || skin.displayIcon || "";
        } else {
          // New skin not yet in static data — use cached fetcher
          displayName = "New Skin";
          const skinLevelData = await getSkinLevelByUuid(itemId);
          if (skinLevelData) {
            displayName = skinLevelData.displayName || displayName;
            displayIcon = skinLevelData.displayIcon || "";
          }
        }
      } else {
        // ── Non-skin item: use cached fetchers ──
        if (itemTypeId === ITEM_TYPE_BUDDY) {
          const buddyData = await getBuddyLevelByUuid(itemId);
          if (buddyData) {
            displayName = buddyData.displayName || displayName;
            displayIcon = buddyData.displayIcon || "";
          }
        } else if (itemTypeId === ITEM_TYPE_SPRAY) {
          const sprayData = await getSprayByUuid(itemId);
          if (sprayData) {
            displayName = sprayData.displayName || displayName;
            displayIcon = sprayData.displayIcon || sprayData.largeArt || sprayData.wideArt || "";
          }
        } else if (itemTypeId === ITEM_TYPE_PLAYER_CARD) {
          const cardData = await getPlayerCardByUuid(itemId);
          if (cardData) {
            displayName = cardData.displayName || displayName;
            displayIcon = cardData.displayIcon || cardData.largeArt || cardData.wideArt || "";
          }
        } else if (itemTypeId === ITEM_TYPE_PLAYER_TITLE) {
          const titleData = await getPlayerTitleByUuid(itemId);
          if (titleData) {
            displayName = titleData.displayName || displayName;
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

  if (bundleItems.length === 0) return null;

  // Derive bundle display name
  let displayName = "Featured Bundle";
  if (bundleMetadata?.displayName) {
    displayName = bundleMetadata.displayName;
  } else {
    const firstSkinItem = bundleItems.find(i => i.itemType === "Skin");
    if (firstSkinItem && firstSkinItem.displayName !== "New Skin") {
      const parts = firstSkinItem.displayName.split(" ");
      if (parts.length > 1) {
        displayName = parts.slice(0, -1).join(" ") + " Bundle";
      }
    }
  }

  // Use v3 API pricing fields if available, otherwise compute from items
  const vpCurrencyId = CURRENCY_IDS.VP;
  const totalBasePrice = rawBundle.TotalBaseCost?.[vpCurrencyId]
    ?? bundleItems.reduce((sum, item) => sum + item.basePrice, 0);
  const totalDiscountedPrice = rawBundle.TotalDiscountedCost?.[vpCurrencyId]
    ?? bundleItems.reduce((sum, item) => sum + item.discountedPrice, 0);

  return {
    bundleUuid: rawBundle.ID,
    dataAssetID: rawBundle.DataAssetID,
    displayName,
    displayIcon: bundleMetadata?.displayIcon || "",
    displayIcon2: bundleMetadata?.displayIcon2 || "",
    items: bundleItems,
    totalBasePrice,
    totalDiscountedPrice,
    durationRemainingInSeconds: rawBundle.DurationRemainingInSeconds,
    expiresAt: new Date(Date.now() + rawBundle.DurationRemainingInSeconds * 1000),
    wholesaleOnly: rawBundle.WholesaleOnly,
  };
}

/**
 * Hydrate ALL featured bundles from the storefront.
 * Returns an array of BundleData — one per active bundle.
 */
export async function hydrateBundles(
  storefront: RiotStorefront,
  staticData: StaticData
): Promise<BundleData[]> {
  // v3 API: use Bundles[] array which contains all active bundles
  const rawBundles = storefront.FeaturedBundle?.Bundles;
  if (!rawBundles || rawBundles.length === 0) {
    // Fallback: try the singular Bundle field
    const singleBundle = storefront.FeaturedBundle?.Bundle;
    if (!singleBundle) return [];
    const hydrated = await hydrateSingleBundle(singleBundle, staticData);
    return hydrated ? [hydrated] : [];
  }

  const results = await Promise.all(
    rawBundles.map(bundle => hydrateSingleBundle(bundle, staticData))
  );

  return results.filter((b): b is BundleData => b !== null);
}

// ---------------------------------------------------------------------------
// High-level orchestration
// ---------------------------------------------------------------------------

/**
 * Fetch and hydrate a complete user store in one call.
 *
 * Combines: storefront fetch → static data fetch → hydration of daily items,
 * bundles, and night market into a single `StoreData` result.
 *
 * Designed for Server Components that need everything in one shot:
 * ```ts
 * const storeData = await fetchUserStore(session);
 * ```
 */
export async function fetchUserStore(
  tokens: StoreTokens,
): Promise<StoreData | null> {
  const [storefront, staticData] = await Promise.all([
    getStorefront(tokens),
    fetchStoreStaticData(),
  ]);

  if (!storefront) return null;

  const [items, nightMarket, bundles] = await Promise.all([
    hydrateDailyItems(storefront, staticData),
    hydrateNightMarket(storefront, staticData),
    hydrateBundles(storefront, staticData),
  ]);

  const expiresAt = new Date(
    Date.now() +
    storefront.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds * 1000,
  );

  return {
    items,
    expiresAt,
    nightMarket: nightMarket ?? undefined,
    bundles,
  };
}

export { getStorefront, getWallet };
