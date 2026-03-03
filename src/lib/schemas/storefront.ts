/**
 * Zod schemas for Riot Storefront (v2/v3) API responses.
 *
 * These schemas validate the raw JSON from Riot's PD endpoints.
 * `.passthrough()` at the top-level allows Riot to add new fields
 * without breaking us, but all *used* fields are strictly checked.
 *
 * @see RiotStorefront in @/types/riot for the equivalent TS interface.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives reused across store/wallet responses
// ---------------------------------------------------------------------------

/** UUID-keyed cost map: { "85ad13f7-...": 1775 } */
const CostMapSchema = z.record(z.string(), z.number());

/**
 * Riot inconsistently returns boolean fields as `true/false` or `0/1`.
 * This schema accepts both and keeps the raw value (no coercion).
 */
const RiotBool = z.union([z.boolean(), z.number()]);

/** Reward item within an offer */
const RewardSchema = z.object({
  ItemTypeID: z.string(),
  ItemID: z.string(),
  Quantity: z.number(),
});

/** A single store offer (appears in Daily Shop and Night Market) */
const StoreOfferSchema = z
  .object({
    OfferID: z.string(),
    IsDirectPurchase: RiotBool,
    StartDate: z.string(),
    Cost: CostMapSchema,
    Rewards: z.array(RewardSchema),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Featured Bundle schemas
// ---------------------------------------------------------------------------

/** Item within a bundle */
const BundleItemSchema = z
  .object({
    Item: z.object({
      ItemTypeID: z.string(),
      ItemID: z.string(),
      Amount: z.number(),
    }),
    BasePrice: z.number(),
    CurrencyID: z.string(),
    DiscountPercent: z.number(),
    DiscountedPrice: z.number(),
    IsPromoItem: RiotBool,
  })
  .passthrough();

/** Individual item offer within a bundle (optional in some responses) */
const BundleItemOfferSchema = z
  .object({
    BundleItemOfferID: z.string(),
    Offer: StoreOfferSchema,
    DiscountPercent: z.number(),
    DiscountedCost: CostMapSchema,
  })
  .passthrough();

/** A complete bundle object from the Riot v3 storefront */
const BundleSchema = z
  .object({
    ID: z.string(),
    DataAssetID: z.string(),
    CurrencyID: z.string(),
    Items: z.array(BundleItemSchema),
    ItemOffers: z.array(BundleItemOfferSchema).optional(),
    TotalBaseCost: CostMapSchema.optional(),
    TotalDiscountedCost: CostMapSchema.optional(),
    TotalDiscountPercent: z.number().optional(),
    DurationRemainingInSeconds: z.number(),
    WholesaleOnly: RiotBool,
    IsGiftable: RiotBool.optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Night Market (Bonus Store) schemas
// ---------------------------------------------------------------------------

/** Night Market bonus offer with discount */
const BonusStoreOfferSchema = z
  .object({
    BonusOfferID: z.string(),
    Offer: StoreOfferSchema,
    DiscountPercent: z.number(),
    DiscountCosts: CostMapSchema,
    IsSeen: RiotBool,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Top-level storefront schema
// ---------------------------------------------------------------------------

export const RiotStorefrontSchema = z
  .object({
    FeaturedBundle: z
      .object({
        Bundle: BundleSchema,
        Bundles: z.array(BundleSchema),
        BundleRemainingDurationInSeconds: z.number(),
      })
      .passthrough(),
    SkinsPanelLayout: z
      .object({
        SingleItemOffers: z.array(z.string()),
        SingleItemOffersRemainingDurationInSeconds: z.number(),
        SingleItemStoreOffers: z.array(StoreOfferSchema),
      })
      .passthrough(),
    BonusStore: z
      .object({
        BonusStoreOffers: z.array(BonusStoreOfferSchema),
        BonusStoreRemainingDurationInSeconds: z.number(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Wallet schema
// ---------------------------------------------------------------------------

/** Riot wallet response: { Balances: { "currency-uuid": amount } } */
export const RiotWalletSchema = z
  .object({
    Balances: CostMapSchema,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Inferred types — single source of truth
// ---------------------------------------------------------------------------

export type RiotStorefrontParsed = z.infer<typeof RiotStorefrontSchema>;
export type RiotWalletParsed = z.infer<typeof RiotWalletSchema>;
