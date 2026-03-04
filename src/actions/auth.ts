"use server";

/**
 * Auth Server Action
 *
 * Handles authentication via URL or Cookie paste. Runs server-side only —
 * credentials never pass through the client's network tab.
 *
 * Used by <LoginForm> as a progressive-enhancement alternative to
 * POST /api/auth (which still exists for external consumers).
 */

import { completeAuthWithUrl } from "@/lib/riot-auth";
import { refreshTokensWithCookies } from "@/lib/riot-reauth";
import { createSession } from "@/lib/session";
import { addAccount } from "@/lib/accounts";
import { createLogger } from "@/lib/logger";

const log = createLogger("Auth Action");

/** Shared helper — identical to the one in the API route */
async function registerAuthenticatedSession(
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
) {
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

export type AuthActionResult =
  | { success: true; puuid: string; region: string }
  | { success: false; error: string };

/**
 * Authenticate with a pasted URL or cookie string.
 *
 * Determines the auth type automatically based on the input:
 * - Starts with "http" → URL-based auth
 * - Otherwise → Cookie-based auth
 */
export async function authenticateWithPaste(
  pastedValue: string,
): Promise<AuthActionResult> {
  try {
    const trimmed = pastedValue.trim();
    const isUrl = trimmed.startsWith("http");

    if (isUrl) {
      // URL-based auth
      const result = await completeAuthWithUrl(trimmed);

      if (!result.success) {
        return { success: false, error: result.error || "Failed to process auth URL" };
      }

      await registerAuthenticatedSession(result.tokens, result.tokens.riotCookies ?? "");

      return {
        success: true,
        puuid: result.tokens.puuid,
        region: result.tokens.region,
      };
    } else {
      // Cookie-based auth
      const result = await refreshTokensWithCookies(trimmed);

      if (!result.success) {
        return { success: false, error: result.error || "Failed to authenticate with cookies" };
      }

      await registerAuthenticatedSession(result.tokens, result.riotCookies ?? "");

      return {
        success: true,
        puuid: result.tokens.puuid,
        region: result.tokens.region,
      };
    }
  } catch (error) {
    log.error("Auth action error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Authentication failed",
    };
  }
}
