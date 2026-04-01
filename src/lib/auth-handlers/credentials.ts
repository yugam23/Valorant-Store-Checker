/**
 * Credentials Auth Handler
 *
 * Handles standard username/password authentication flow with MFA support.
 */

import { NextResponse } from "next/server";
import { authenticateRiotAccount } from "@/lib/riot-auth";
import { registerAuthenticatedSession } from "./shared";
import type { AuthBody } from "./shared";

export async function handleCredentialsAuth(
  body: Extract<AuthBody, { type: "auth" }>,
): Promise<NextResponse> {
  const result = await authenticateRiotAccount(body.username, body.password);

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
