import { z } from "zod";

export const StoredSessionSchema = z.object({
  accessToken: z.string(),
  idToken: z.string().optional(),
  entitlementsToken: z.string(),
  puuid: z.string(),
  region: z.string(),
  gameName: z.string().optional(),
  tagLine: z.string().optional(),
  country: z.string().optional(),
  riotCookies: z.string().optional(),
  createdAt: z.number(),
}).passthrough();
