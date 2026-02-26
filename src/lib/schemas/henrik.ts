import { z } from "zod";

export const HenrikAccountSchema = z
  .object({
    puuid: z.string(),
    region: z.string(),
    account_level: z.number(),
    name: z.string(),
    tag: z.string(),
    card: z.object({
      small: z.string(),
      large: z.string(),
      wide: z.string(),
      id: z.string(),
    }),
    last_update: z.string(),
    last_update_raw: z.number(),
  })
  .passthrough();

const HenrikMMRTierSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const HenrikMMRCurrentSchema = z.object({
  tier: HenrikMMRTierSchema,
  rr: z.number(),
  last_change: z.number(),
  elo: z.number(),
  games_needed_for_rating: z.number(),
});

const HenrikMMRPeakSchema = z.object({
  season: z
    .object({
      id: z.string(),
      short: z.string(),
    })
    .optional(),
  tier: HenrikMMRTierSchema.optional(),
});

export const HenrikMMRSchema = z.object({
  current: HenrikMMRCurrentSchema.optional(),
  peak: HenrikMMRPeakSchema.optional(),
});
