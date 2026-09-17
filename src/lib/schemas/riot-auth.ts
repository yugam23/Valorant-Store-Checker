import { z } from "zod";

export const EntitlementsResponseSchema = z
  .object({ entitlements_token: z.string() })
  .passthrough();

// Only `sub` (PUUID) is required. Riot omits or changes the other fields
// depending on how the account was created / logged in (e.g. social login via
// Google or Apple returns no `email_verified` / `pw`), so everything else is
// optional to avoid rejecting valid tokens.
export const UserInfoSchema = z
  .object({
    country: z.string().nullish(),
    sub: z.string(),
    email_verified: z.boolean().nullish(),
    phone_number_verified: z.boolean().nullish(),
    account_verified: z.boolean().nullish(),
    age: z.number().nullish(),
    jti: z.string().nullish(),
    player_plocale: z.string().nullish(),
    country_at: z.number().nullish(),
    pw: z
      .object({
        cng_at: z.number().nullish(),
        reset: z.boolean().nullish(),
        must_reset: z.boolean().nullish(),
      })
      .passthrough()
      .nullish(),
    ppid: z.string().nullish(),
    player_locale: z.string().nullish(),
    acct: z
      .object({
        type: z.number().nullish(),
        state: z.string().nullish(),
        adm: z.boolean().nullish(),
        game_name: z.string().nullish(),
        tag_line: z.string().nullish(),
        created_at: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
    affinity: z.record(z.string()).nullish(),
  })
  .passthrough();

export const AuthResponseSchema = z.object({
  type: z.enum(["response", "multifactor"]),
  accessToken: z.string().min(1).optional(),
  idToken: z.string().min(1).optional(),
  expiresAt: z.number().positive().optional(),
  expiresIn: z.number().positive().optional(),
  multifactor: z.object({
    email: z.string().email().optional(),
    method: z.string().optional(),
  }).optional(),
  // Riot API returns tokens in response.parameters.uri for 'response' type
  response: z.object({
    mode: z.string().optional(),
    parameters: z.object({
      uri: z.string().optional(),
    }).optional(),
  }).optional(),
}).strip();
