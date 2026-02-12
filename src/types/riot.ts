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
export interface RiotStorefront {
  FeaturedBundle: {
    Bundle: {
      ID: string;
      DataAssetID: string;
      CurrencyID: string;
      Items: Array<{
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
      }>;
      DurationRemainingInSeconds: number;
      WholesaleOnly: boolean;
    };
    Bundles: Array<{
      ID: string;
      DataAssetID: string;
      CurrencyID: string;
      Items: Array<{
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
      }>;
      DurationRemainingInSeconds: number;
      WholesaleOnly: boolean;
    }>;
    BundleRemainingDurationInSeconds: number;
  };
  SkinsPanelLayout: {
    SingleItemOffers: string[]; // Array of skin UUIDs
    SingleItemOffersRemainingDurationInSeconds: number;
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

// ============================================
// Currency Types
// ============================================

/**
 * Standard Valorant currency IDs
 */
export const CURRENCY_IDS = {
  VP: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741", // Valorant Points
  RP: "e59aa87c-4cbf-517a-5983-6e81511be9b7", // Radianite Points
  KC: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d", // Kingdom Credits (Free Agent)
} as const;

export type CurrencyType = keyof typeof CURRENCY_IDS;
