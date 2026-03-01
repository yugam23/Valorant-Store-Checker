import { z } from "zod";

export const EntitlementsResponseSchema = z
  .object({ entitlements_token: z.string() })
  .passthrough();

export const UserInfoSchema = z
  .object({
    country: z.string(),
    sub: z.string(),
    email_verified: z.boolean(),
    phone_number_verified: z.boolean(),
    account_verified: z.boolean(),
    age: z.number(),
    jti: z.string(),
    player_plocale: z.string().nullish(),
    country_at: z.number().optional(),
    pw: z
      .object({
        cng_at: z.number(),
        reset: z.boolean(),
        must_reset: z.boolean(),
      })
      .optional(),
    ppid: z.string().nullish(),
    player_locale: z.string().optional(),
    acct: z
      .object({
        type: z.number(),
        state: z.string(),
        adm: z.boolean(),
        game_name: z.string(),
        tag_line: z.string(),
        created_at: z.number(),
      })
      .optional(),
    affinity: z.record(z.string()).optional(),
  })
  .passthrough();

export const AuthResponseSchema = z
  .object({ type: z.string() })
  .passthrough();
