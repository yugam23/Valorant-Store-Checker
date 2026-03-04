/**
 * URL Auth Handler
 *
 * Handles "paste auth URL" authentication flow.
 * Extracts tokens from a Riot auth redirect URL.
 */

import { NextResponse } from "next/server";
import { registerAuthenticatedSession } from "./shared";
import type { AuthBody } from "./shared";

export async function handleUrlAuth(
  body: Extract<AuthBody, { type: "url" }>,
): Promise<NextResponse> {
  // Import dynamically to avoid circular deps if any
  const { completeAuthWithUrl } = await import("@/lib/riot-auth");
  const result = await completeAuthWithUrl(body.url);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to process auth URL" },
      { status: 401 },
    );
  }

  await registerAuthenticatedSession(result.tokens, result.tokens.riotCookies ?? "");

  return NextResponse.json({
    success: true,
    data: {
      puuid: result.tokens.puuid,
      region: result.tokens.region,
    },
  });
}
