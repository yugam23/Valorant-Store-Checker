/**
 * Credentials Auth Handler
 *
 * Handles standard username/password authentication flow.
 * Includes browser-auth fallback and MFA challenge passthrough.
 */

import { NextResponse } from "next/server";
import { authenticateRiotAccount } from "@/lib/riot-auth";
import { authenticateWithBrowser } from "@/lib/browser-auth";
import { registerAuthenticatedSession, log } from "./shared";
import type { AuthBody } from "./shared";

export async function handleCredentialsAuth(
  body: Extract<AuthBody, { type: "auth" }>,
): Promise<NextResponse> {
  let result;

  if (body.useBrowser) {
    log.info("Using browser-based authentication (forced)");
    result = await authenticateWithBrowser(body.username, body.password);
  } else {
    // Try standard auth first
    result = await authenticateRiotAccount(body.username, body.password);

    // Fallback to browser auth if standard auth fails and it's NOT an MFA challenge
    if (!result.success && !("type" in result && result.type === "multifactor")) {
      log.info("Standard auth failed, falling back to browser auth...");
      const browserResult = await authenticateWithBrowser(body.username, body.password);

      if (browserResult.success) {
        result = browserResult;
      } else {
        log.warn(`Browser auth also failed: ${browserResult.error}`);
        // Return the browser error as it was the last attempt
        result = browserResult;
      }
    }
  }

  if (!result.success) {
    // Check if MFA is required (only for standard auth currently)
    if ("type" in result && result.type === "multifactor") {
      return NextResponse.json({
        success: false,
        requiresMfa: true,
        cookie: result.cookie,
        multifactor: result.multifactor,
      });
    }

    // Authentication failed
    const errorMsg = "error" in result ? result.error : "Authentication failed";
    return NextResponse.json(
      { error: errorMsg || "Authentication failed" },
      { status: 401 },
    );
  }

  // Authentication successful - create session with tokens + Riot cookies for SSID re-auth
  const tokens = "tokens" in result ? result.tokens : null;
  if (!tokens) {
    return NextResponse.json(
      { error: "Authentication successful but failed to retrieve tokens" },
      { status: 500 },
    );
  }

  const riotCookies =
    "riotCookies" in result ? (result as { riotCookies: string }).riotCookies : "";

  await registerAuthenticatedSession(tokens, riotCookies);

  return NextResponse.json({
    success: true,
    data: {
      puuid: tokens.puuid,
      region: tokens.region,
    },
  });
}
