/**
 * Auth Handler Shared Utilities
 *
 * Shared schema, types, and utility functions used by all auth handler modules.
 * Extracted from src/app/api/auth/route.ts to enable per-handler testability.
 */

import { z } from "zod";
import { createSession } from "@/lib/session";
import { addAccount } from "@/lib/accounts";
import { createLogger } from "@/lib/logger";

export const log = createLogger("Auth API");

export const AuthBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("auth"),
    username: z.string(),
    password: z.string(),
  }),
  z.object({
    type: z.literal("multifactor"),
    code: z.string(),
    cookie: z.string(),
  }),
  z.object({
    type: z.literal("url"),
    url: z.string(),
  }),
  z.object({
    type: z.literal("cookie"),
    cookie: z.string(),
  }),
  z.object({
    type: z.literal("launch_browser"),
  }),
]);

export type AuthBody = z.infer<typeof AuthBodySchema>;

/**
 * Create a session cookie and register the account in the multi-account registry.
 *
 * Centralises the repeated `createSession` + `addAccount` pattern so every
 * auth branch (credentials, MFA, URL, cookie) goes through a single path.
 */
export async function registerAuthenticatedSession(
  tokens: {
    accessToken: string;
    entitlementsToken: string;
    puuid: string;
    region: string;
    gameName?: string;
    tagLine?: string;
    country?: string;
  },
  riotCookies: string,
): Promise<void> {
  await createSession({ ...tokens, riotCookies });
  await addAccount(
    {
      puuid: tokens.puuid,
      region: tokens.region,
      gameName: tokens.gameName,
      tagLine: tokens.tagLine,
      addedAt: Date.now(),
    },
    {
      accessToken: tokens.accessToken,
      entitlementsToken: tokens.entitlementsToken,
      puuid: tokens.puuid,
      region: tokens.region,
      gameName: tokens.gameName,
      tagLine: tokens.tagLine,
      country: tokens.country,
      riotCookies,
    },
  );
}
