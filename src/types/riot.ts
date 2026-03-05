/**
 * Type definitions for Riot Games API responses
 * @see https://valorант-api.com/v1/
 */

// ============================================
// Riot Store API Types
// ============================================

/**
 * Player's storefront containing daily offers and bonus store
 */
/** Shape of individual bundle items in the Riot storefront response */
export interface RiotBundleItem {
  Item: {
    ItemTypeID: string;
    ItemID: string;
    Amount: number;
  };
  BasePrice: number;
  CurrencyID: string;
  DiscountPercent: number;
  DiscountedPrice: number;
  IsPromoItem: boolean;
}

/** Shape of a bundle object from the Riot v3 storefront */
export interface RiotBundle {
  ID: string;
  DataAssetID: string;
  CurrencyID: string;
  Items: RiotBundleItem[];
  ItemOffers?: Array<{
    BundleItemOfferID: string;
    Offer: {
      OfferID: string;
      IsDirectPurchase: boolean;
      StartDate: string;
      Cost: Record<string, number>;
      Rewards: Array<{
        ItemTypeID: string;
        ItemID: string;
        Quantity: number;
      }>;
    };
    DiscountPercent: number;
    DiscountedCost: Record<string, number>;
  }>;
  TotalBaseCost?: Record<string, number>;
  TotalDiscountedCost?: Record<string, number>;
  TotalDiscountPercent?: number;
  DurationRemainingInSeconds: number;
  WholesaleOnly: boolean;
  IsGiftable?: boolean;
}

export interface RiotStorefront {
  FeaturedBundle: {
    Bundle: RiotBundle;
    Bundles: RiotBundle[];
    BundleRemainingDurationInSeconds: number;
  };
  SkinsPanelLayout: {
    SingleItemOffers: string[]; // Array of skin UUIDs
    SingleItemOffersRemainingDurationInSeconds: number;
    SingleItemStoreOffers: Array<{
      OfferID: string;
      IsDirectPurchase: boolean;
      StartDate: string;
      Cost: {
        [currencyID: string]: number;
      };
      Rewards: Array<{
        ItemTypeID: string;
        ItemID: string;
        Quantity: number;
      }>;
    }>;
  };
  BonusStore?: {
    BonusStoreOffers: Array<{
      BonusOfferID: string;
      Offer: {
        OfferID: string;
        IsDirectPurchase: boolean;
        StartDate: string;
        Cost: {
          [currencyID: string]: number;
        };
        Rewards: Array<{
          ItemTypeID: string;
          ItemID: string;
          Quantity: number;
        }>;
      };
      DiscountPercent: number;
      DiscountCosts: {
        [currencyID: string]: number;
      };
      IsSeen: boolean;
    }>;
    BonusStoreRemainingDurationInSeconds: number;
  };
}

/**
 * Player's wallet containing VP, RP, and Radianite
 */
export interface RiotWallet {
  Balances: {
    [currencyID: string]: number;
  };
}

/**
 * Offer from the store containing price and reward info
 */
export interface RiotStoreOffer {
  OfferID: string;
  IsDirectPurchase: boolean;
  StartDate: string;
  Cost: {
    [currencyID: string]: number;
  };
  Rewards: Array<{
    ItemTypeID: string;
    ItemID: string;
    Quantity: number;
  }>;
}

// ============================================
// Valorant-API.com Types
// ============================================

/**
 * Content tier (rarity) data from Valorant-API
 */
export interface ValorantContentTier {
  uuid: string;
  displayName: string;
  devName: string;
  rank: number;
  juiceValue: number;
  juiceCost: number;
  highlightColor: string; // Hex color like "edd65aff"
  displayIcon: string;
  assetPath: string;
}

/**
 * Weapon skin data from Valorant-API
 */
export interface ValorantWeaponSkin {
  uuid: string;
  displayName: string;
  themeUuid: string;
  contentTierUuid: string | null;
  displayIcon: string | null;
  wallpaper: string | null;
  assetPath: string;
  chromas: Array<{
    uuid: string;
    displayName: string;
    displayIcon: string | null;
    fullRender: string;
    swatch: string | null;
    streamedVideo: string | null;
    assetPath: string;
  }>;
  levels: Array<{
    uuid: string;
    displayName: string;
    levelItem: string | null;
    displayIcon: string | null;
    streamedVideo: string | null;
    assetPath: string;
  }>;
}

/**
 * API response wrapper from Valorant-API
 */
export interface ValorantAPIResponse<T> {
  status: number;
  data: T;
}

/**
 * Bundle data from Valorant-API
 */
export interface ValorantBundle {
  uuid: string;
  displayName: string;
  displayNameSubText: string | null;
  description: string | null;
  extraDescription: string | null;
  promoDescription: string | null;
  useAdditionalContext: boolean;
  displayIcon: string;
  displayIcon2: string;
  verticalPromoImage: string | null;
  assetPath: string;
}

// ============================================
// Currency Types
// ============================================

/** Standard Valorant currency IDs — defined in src/lib/constants.ts */
export { CURRENCY_IDS } from "@/lib/constants";
export type { CurrencyType } from "@/lib/constants";
