/**
 * Mock response data for MSW handlers.
 * Each function returns realistic mock data matching the actual API response shapes
 * validated by Zod schemas in src/lib/schemas/.
 */

import type {
  ValorantAPIResponse,
  ValorantWeaponSkin,
  ValorantContentTier,
} from "@/types/riot";
import type { RiotStorefront, RiotWallet } from "@/types/riot";
import type { HenrikAccount, HenrikMMRData } from "@/lib/henrik-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mock PUUID used across all mock data for consistency */
export const MOCK_PUUID = "mock-puuid-00000000-0000-0000-0000-000000000000";

/** Mock skin UUIDs that appear in the storefront */
export const MOCK_SKIN_UUID_1 = "9a1c1b1b-549b-4b53-9cce-1bc3c3f4d3e4";
export const MOCK_SKIN_UUID_2 = "5a3c9b3a-4e2d-4f7c-8c9e-2b3a4c5d6e7f";

/** VP currency ID */
const VP_ID = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";
/** RP currency ID */
const RP_ID = "e59aa87c-4cbf-517a-5983-6e81511be9b7";
/** Weapon skin item type ID */
const WEAPON_SKIN_ITEM_TYPE = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";

// ---------------------------------------------------------------------------
// Auth mock data
// ---------------------------------------------------------------------------

/**
 * Mock user info response from Riot /userinfo endpoint.
 * Returns a shape matching UserInfoSchema (src/lib/schemas/riot-auth.ts).
 */
export function getMockUserInfo(): Record<string, unknown> {
  return {
    country: "US",
    sub: MOCK_PUUID,
    email_verified: true,
    phone_number_verified: true,
    account_verified: true,
    age: 18,
    jti: "mock-jti-12345678",
    player_plocale: "en_US",
    player_locale: "en_US",
    acct: {
      type: 1,
      state: "ACTIVE",
      adm: false,
      game_name: "MockPlayer",
      tag_line: "NA1",
      created_at: 1609459200000,
    },
    affinity: { pp: "na" },
  };
}

/**
 * Mock entitlements token response from Riot entitlements endpoint.
 * Returns a shape matching EntitlementsResponseSchema.
 */
export function getMockEntitlements(): Record<string, unknown> {
  return {
    entitlements_token: "mock_entitlements_token_xxxxxxxxxxxxxx",
  };
}

// ---------------------------------------------------------------------------
// Store mock data
// ---------------------------------------------------------------------------

/**
 * Mock storefront response from Riot PD /store/v3/storefront endpoint.
 * Returns a shape matching RiotStorefrontSchema (src/lib/schemas/storefront.ts).
 */
export function getMockStorefront(_puuid: string): RiotStorefront {
  return {
    FeaturedBundle: {
      Bundle: {
        ID: "mock-bundle-id",
        DataAssetID: "mock-data-asset-id",
        CurrencyID: VP_ID,
        Items: [],
        ItemOffers: [],
        DurationRemainingInSeconds: 0,
        WholesaleOnly: false,
      },
      Bundles: [],
      BundleRemainingDurationInSeconds: 0,
    },
    SkinsPanelLayout: {
      SingleItemOffers: [MOCK_SKIN_UUID_1, MOCK_SKIN_UUID_2],
      SingleItemOffersRemainingDurationInSeconds: 41340,
      SingleItemStoreOffers: [
        {
          OfferID: MOCK_SKIN_UUID_1,
          IsDirectPurchase: true,
          StartDate: new Date().toISOString(),
          Cost: { [VP_ID]: 1775 },
          Rewards: [
            {
              ItemTypeID: WEAPON_SKIN_ITEM_TYPE,
              ItemID: MOCK_SKIN_UUID_1,
              Quantity: 1,
            },
          ],
        },
        {
          OfferID: MOCK_SKIN_UUID_2,
          IsDirectPurchase: true,
          StartDate: new Date().toISOString(),
          Cost: { [VP_ID]: 1275 },
          Rewards: [
            {
              ItemTypeID: WEAPON_SKIN_ITEM_TYPE,
              ItemID: MOCK_SKIN_UUID_2,
              Quantity: 1,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Mock wallet response from Riot PD /store/v1/wallet endpoint.
 * Returns a shape matching RiotWalletSchema.
 */
export function getMockWallet(_puuid: string): RiotWallet {
  return {
    Balances: {
      [VP_ID]: 5000,
      [RP_ID]: 250,
    },
  };
}

// ---------------------------------------------------------------------------
// Valorant-API mock data
// ---------------------------------------------------------------------------

/**
 * Mock weapon skins response from valorant-api.com/v1/weapons/skins.
 * Returns a ValorantAPIResponse wrapping ValorantWeaponSkin[].
 */
export function getMockWeaponSkins(): ValorantAPIResponse<ValorantWeaponSkin[]> {
  const skins: ValorantWeaponSkin[] = [
    {
      uuid: MOCK_SKIN_UUID_1,
      displayName: "Prime Vandal",
      themeUuid: "0bb42452-5c1c-4dbc-9c90-5889401b9973",
      contentTierUuid: "0cebb8be-46d7-c12a-16b1-9f05bf91a318",
      displayIcon: "https://media.valorant-api.com/weaponskinchromas/9a1c1b1b-549b-4b53-9cce-1bc3c3f4d3e4/displayicon.png",
      wallpaper: null,
      assetPath: "SkinsGameData/WeaponSkinData/PrimeVandal/PrimeVandal.asset",
      chromas: [
        {
          uuid: "mock-chroma-uuid-1",
          displayName: "Prime Vandal",
          displayIcon: "https://media.valorant-api.com/weaponskinchromas/9a1c1b1b-549b-4b53-9cce-1bc3c3f4d3e4/displayicon.png",
          fullRender: "https://media.valorant-api.com/weaponskinchromas/9a1c1b1b-549b-4b53-9cce-1bc3c3f4d3e4/fullrender.png",
          swatch: null,
          streamedVideo: null,
          assetPath: "SkinsGameData/WeaponSkinData/PrimeVandal/PrimeVandal_Chroma1.asset",
        },
      ],
      levels: [
        {
          uuid: "mock-level-uuid-1",
          displayName: "Prime Vandal",
          levelItem: null,
          displayIcon: "https://media.valorant-api.com/weaponskinlevels/mock-level-uuid-1/displayicon.png",
          streamedVideo: null,
          assetPath: "SkinsGameData/WeaponSkinData/PrimeVandal/PrimeVandal_Level1.asset",
        },
      ],
    },
    {
      uuid: MOCK_SKIN_UUID_2,
      displayName: "Reaver Omega",
      themeUuid: "c6619b1c-4c3c-4a6c-a42c-5a0f9c2e7b3d",
      contentTierUuid: "0cebb8be-46d7-c12a-16b1-9f05bf91a318",
      displayIcon: "https://media.valorant-api.com/weaponskinchromas/5a3c9b3a-4e2d-4f7c-8c9e-2b3a4c5d6e7f/displayicon.png",
      wallpaper: null,
      assetPath: "SkinsGameData/WeaponSkinData/ReaverOmega/ReaverOmega.asset",
      chromas: [
        {
          uuid: "mock-chroma-uuid-2",
          displayName: "Reaver Omega",
          displayIcon: "https://media.valorant-api.com/weaponskinchromas/5a3c9b3a-4e2d-4f7c-8c9e-2b3a4c5d6e7f/displayicon.png",
          fullRender: "https://media.valorant-api.com/weaponskinchromas/5a3c9b3a-4e2d-4f7c-8c9e-2b3a4c5d6e7f/fullrender.png",
          swatch: null,
          streamedVideo: null,
          assetPath: "SkinsGameData/WeaponSkinData/ReaverOmega/ReaverOmega_Chroma1.asset",
        },
      ],
      levels: [
        {
          uuid: "mock-level-uuid-2",
          displayName: "Reaver Omega",
          levelItem: null,
          displayIcon: "https://media.valorant-api.com/weaponskinlevels/mock-level-uuid-2/displayicon.png",
          streamedVideo: null,
          assetPath: "SkinsGameData/WeaponSkinData/ReaverOmega/ReaverOmega_Level1.asset",
        },
      ],
    },
  ];

  return {
    status: 200,
    data: skins,
  };
}

/**
 * Mock content tiers response from valorant-api.com/v1/contenttiers.
 * Returns a ValorantAPIResponse wrapping ValorantContentTier[].
 */
export function getMockContentTiers(): ValorantAPIResponse<ValorantContentTier[]> {
  return {
    status: 200,
    data: [
      {
        uuid: "0cebb8be-46d7-c12a-16b1-9f05bf91a318",
        displayName: "Select",
        devName: "Tier_1",
        rank: 1,
        juiceValue: 0,
        juiceCost: 0,
        highlightColor: "829681c4",
        displayIcon: "https://media.valorant-api.com/contenttiers/0cebb8be-46d7-c12a-16b1-9f05bf91a318/displayicon.png",
        assetPath: "ContentTierData/ContentTier_Select/ContentTier_Select.asset",
      },
      {
        uuid: "3d2968e0-4c3c-4e5e-9f90-5a6b7c8d9e0f",
        displayName: "Deluxe",
        devName: "Tier_2",
        rank: 2,
        juiceValue: 0,
        juiceCost: 0,
        highlightColor: "084852dd",
        displayIcon: "https://media.valorant-api.com/contenttiers/3d2968e0-4c3c-4e5e-9f90-5a6b7c8d9e0f/displayicon.png",
        assetPath: "ContentTierData/ContentTier_Deluxe/ContentTier_Deluxe.asset",
      },
      {
        uuid: "5d6a7c8e-9f0a-4b5c-8d9e-0f1a2b3c4d5e",
        displayName: "Premium",
        devName: "Tier_3",
        rank: 3,
        juiceValue: 0,
        juiceCost: 0,
        highlightColor: "b34e6d2c",
        displayIcon: "https://media.valorant-api.com/contenttiers/5d6a7c8e-9f0a-4b5c-8d9e-0f1a2b3c4d5e/displayicon.png",
        assetPath: "ContentTierData/ContentTier_Premium/ContentTier_Premium.asset",
      },
      {
        uuid: "7e8f9a0b-1c2d-3e4f-5a6b-7c8d9e0f1a2b",
        displayName: "Exclusive",
        devName: "Tier_4",
        rank: 4,
        juiceValue: 0,
        juiceCost: 0,
        highlightColor: "7e5c10cc",
        displayIcon: "https://media.valorant-api.com/contenttiers/7e8f9a0b-1c2d-3e4f-5a6b-7c8d9e0f1a2b/displayicon.png",
        assetPath: "ContentTierData/ContentTier_Exclusive/ContentTier_Exclusive.asset",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Henrik API mock data
// ---------------------------------------------------------------------------

/**
 * Mock account response from Henrik /v2/by-puuid/account endpoint.
 * Returns a shape matching HenrikAccountSchema (src/lib/schemas/henrik.ts).
 */
export function getMockHenrikAccount(puuid: string): HenrikAccount {
  return {
    puuid,
    region: "na",
    account_level: 45,
    name: "MockPlayer",
    tag: "NA1",
    card: {
      small: "https://media.valorant-api.com/playercards/mock-card-id/small.png",
      large: "https://media.valorant-api.com/playercards/mock-card-id/large.png",
      wide: "https://media.valorant-api.com/playercards/mock-card-id/wide.png",
      id: "mock-card-id",
    },
    last_update: new Date().toISOString(),
    last_update_raw: Date.now(),
  };
}

/**
 * Mock MMR response from Henrik /v3/by-puuid/mmr endpoint.
 * Returns a shape matching HenrikMMRSchema.
 */
export function getMockHenrikMMR(): HenrikMMRData {
  return {
    current: {
      tier: {
        id: 10,
        name: "Gold2",
      },
      rr: 67,
      last_change: 15,
      elo: 1845,
      games_needed_for_rating: 3,
    },
    peak: {
      season: {
        id: "episode_6_act_1",
        short: "e6a1",
      },
      tier: {
        id: 11,
        name: "Gold3",
      },
    },
  };
}
