/**
 * Cookie Auth Handler
 *
 * Handles "paste cookies" authentication flow.
 * Refreshes tokens using raw Riot cookie string.
 */

import { NextResponse } from "next/server";
import { registerAuthenticatedSession } from "./shared";
import type { AuthBody } from "./shared";
import { rateLimit } from "@/lib/rate-limiter";
import { getClientIP } from "@/lib/rate-limit-utils";

export async function handleCookieAuth(
  body: Extract<AuthBody, { type: "cookie" }>,
  headers?: Headers,
): Promise<NextResponse> {
  if (headers) {
    const ip = getClientIP(headers);
    const { success, limit, remaining, reset } = await rateLimit(ip);

    const rateLimitHeaders = {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": reset.toString(),
    };

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders },
      );
    }

    const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
    const result = await refreshTokensWithCookies(body.cookie);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to authenticate with cookies" },
        { status: 401, headers: rateLimitHeaders },
      );
    }

    await registerAuthenticatedSession(result.tokens, result.riotCookies ?? "");

    return NextResponse.json(
      {
        success: true,
        data: {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
        },
      },
      { headers: rateLimitHeaders },
    );
  }

  // Fallback: if no headers provided, proceed without rate limiting
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
