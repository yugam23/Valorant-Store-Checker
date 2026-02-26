import { z } from "zod";

export const RiotStorefrontSchema = z.object({
  FeaturedBundle: z.object({
    Bundle: z.object({}).passthrough(),
    Bundles: z.array(z.object({}).passthrough()),
    BundleRemainingDurationInSeconds: z.number(),
  }).passthrough(),
  SkinsPanelLayout: z.object({
    SingleItemOffers: z.array(z.string()),
    SingleItemOffersRemainingDurationInSeconds: z.number(),
    SingleItemStoreOffers: z.array(z.object({}).passthrough()),
  }).passthrough(),
  BonusStore: z.object({
    BonusStoreOffers: z.array(z.object({}).passthrough()),
    BonusStoreRemainingDurationInSeconds: z.number(),
  }).passthrough().optional(),
}).passthrough();
