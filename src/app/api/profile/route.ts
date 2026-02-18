/**
 * Profile API Route
 *
 * Protected endpoint that returns the authenticated player's full profile data —
 * identity (card, title, level), and competitive rank.
 *
 * Delegates all fetching, caching, and graceful degradation to getProfileData().
 * This route is the thin HTTP layer; it never re-implements parallel fetch logic.
 */

import { NextResponse } from "next/server";
import { getSessionWithRefresh } from "@/lib/session";
import { getProfileData } from "@/lib/profile-cache";
import { type StoreTokens } from "@/lib/riot-store";
import { createLogger } from "@/lib/logger";

const log = createLogger("Profile API");

export async function GET() {
  try {
    // 1. Get session with automatic token refresh
    const session = await getSessionWithRefresh();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 2. Build StoreTokens inline from session fields
    const tokens: StoreTokens = {
      accessToken: session.accessToken,
      entitlementsToken: session.entitlementsToken,
      puuid: session.puuid,
      region: session.region,
    };

    // 3. Fetch profile data — never throws; returns ProfileData with partial flag
    const profileData = await getProfileData(tokens, session.region);

    log.info(
      `Profile fetched — fromCache: ${profileData.fromCache}, partial: ${profileData.partial}`
    );

    // 4. Return ProfileData JSON — always HTTP 200; client reads partial flag
    return NextResponse.json(profileData, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    log.error("Unhandled error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch profile data",
        code: "UNKNOWN",
      },
      { status: 500 }
    );
  }
}
