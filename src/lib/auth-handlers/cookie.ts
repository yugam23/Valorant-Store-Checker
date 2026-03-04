/**
 * Cookie Auth Handler
 *
 * Handles "paste cookies" authentication flow.
 * Refreshes tokens using raw Riot cookie string.
 */

import { NextResponse } from "next/server";
import { registerAuthenticatedSession } from "./shared";
import type { AuthBody } from "./shared";

export async function handleCookieAuth(
  body: Extract<AuthBody, { type: "cookie" }>,
): Promise<NextResponse> {
  const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
  const result = await refreshTokensWithCookies(body.cookie);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to authenticate with cookies" },
      { status: 401 },
    );
  }

  await registerAuthenticatedSession(result.tokens, result.riotCookies ?? "");

  return NextResponse.json({
    success: true,
    data: {
      puuid: result.tokens.puuid,
      region: result.tokens.region,
    },
  });
}
