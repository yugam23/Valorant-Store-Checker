/**
 * Authentication API Route
 *
 * Handles login requests by proxying to Riot Games authentication API.
 * This route ensures credentials and tokens never reach the client.
 *
 * Endpoints:
 * - POST /api/auth - Login with credentials or submit MFA code
 *
 * Security:
 * - Credentials processed server-side only
 * - Tokens stored in HTTP-only cookies
 * - No sensitive data in response body
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRiotAccount, submitMfa } from "@/lib/riot-auth";
import { authenticateWithBrowser } from "@/lib/browser-auth";
import { createSession } from "@/lib/session";
import { addAccount } from "@/lib/accounts";
import { createLogger } from "@/lib/logger";

const log = createLogger("Auth API");

interface LoginRequestBody {
  username?: string;
  password?: string;
  type?: "auth" | "multifactor" | "url" | "cookie" | "launch_browser";
  code?: string;
  cookie?: string;
  url?: string;
  useBrowser?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequestBody = await request.json();

    // Validate request type
    if (!body.type || (body.type !== "auth" && body.type !== "multifactor" && body.type !== "url" && body.type !== "cookie" && body.type !== "launch_browser")) {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      );
    }

    // Handle Browser Auth (Paste URL)
    if (body.type === "url") {
      if (!body.url) {
        return NextResponse.json(
          { error: "Redirect URL is required" },
          { status: 400 }
        );
      }

      // Import dynamically to avoid circular deps if any
      const { completeAuthWithUrl } = await import("@/lib/riot-auth");
      const result = await completeAuthWithUrl(body.url);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to process auth URL" },
          { status: 401 }
        );
      }

      // Create session with tokens
      await createSession(result.tokens);

      // Add account to multi-account registry
      await addAccount(
        {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
          gameName: result.tokens.gameName,
          tagLine: result.tokens.tagLine,
          addedAt: Date.now(),
        },
        {
          accessToken: result.tokens.accessToken,
          entitlementsToken: result.tokens.entitlementsToken,
          puuid: result.tokens.puuid,
          region: result.tokens.region,
          gameName: result.tokens.gameName,
          tagLine: result.tokens.tagLine,
          country: result.tokens.country,
          riotCookies: result.tokens.riotCookies,
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
        },
      });
    }

    // Handle Cookie Auth (Paste Cookies)
    if (body.type === "cookie") {
      if (!body.cookie) {
        return NextResponse.json(
          { error: "Cookie string is required" },
          { status: 400 }
        );
      }

      const { refreshTokensWithCookies } = await import("@/lib/riot-auth");
      const result = await refreshTokensWithCookies(body.cookie);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to authenticate with cookies" },
          { status: 401 }
        );
      }

      // Create session with tokens + updated Riot cookies
      await createSession({
        ...result.tokens,
        riotCookies: result.riotCookies,
      });

      // Add account to multi-account registry
      await addAccount(
        {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
          gameName: result.tokens.gameName,
          tagLine: result.tokens.tagLine,
          addedAt: Date.now(),
        },
        {
          accessToken: result.tokens.accessToken,
          entitlementsToken: result.tokens.entitlementsToken,
          puuid: result.tokens.puuid,
          region: result.tokens.region,
          gameName: result.tokens.gameName,
          tagLine: result.tokens.tagLine,
          country: result.tokens.country,
          riotCookies: result.riotCookies,
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
        },
      });
    }

    // Handle MFA submission
    if (body.type === "multifactor") {
      if (!body.code || !body.cookie) {
        return NextResponse.json(
          { error: "MFA code and session cookie are required" },
          { status: 400 }
        );
      }

      const result = await submitMfa(body.code, body.cookie);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "MFA verification failed" },
          { status: 401 }
        );
      }

      // Create session with tokens + Riot cookies for SSID re-auth
      await createSession({
        ...result.tokens,
        riotCookies: result.riotCookies ?? "",
      });

      // Add account to multi-account registry
      await addAccount(
        {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
          gameName: result.tokens.gameName,
          tagLine: result.tokens.tagLine,
          addedAt: Date.now(),
        },
        {
          accessToken: result.tokens.accessToken,
          entitlementsToken: result.tokens.entitlementsToken,
          puuid: result.tokens.puuid,
          region: result.tokens.region,
          gameName: result.tokens.gameName,
          tagLine: result.tokens.tagLine,
          country: result.tokens.country,
          riotCookies: result.riotCookies ?? "",
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
        },
      });
    }

    // Handle Browser Launch (Interactive)
    if (body.type === "launch_browser") {
      const { launchBasicBrowser } = await import("@/lib/browser-auth");
      const result = await launchBasicBrowser();

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to launch browser" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Browser launched successfully"
      });
    }

    // Handle initial authentication
    if (body.type === "auth") {

      if (!body.username || !body.password) {
        return NextResponse.json(
          { error: "Username and password are required" },
          { status: 400 }
        );
      }

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
          { status: 401 }
        );
      }

      // Authentication successful - create session with tokens + Riot cookies for SSID re-auth
      const tokens = 'tokens' in result ? result.tokens : null;
      if (!tokens) {
          return NextResponse.json(
            { error: "Authentication successful but failed to retrieve tokens" },
            { status: 500 }
          );
      }

      const riotCookies = "riotCookies" in result ? (result as { riotCookies: string }).riotCookies : "";

      await createSession({
        ...tokens,
        riotCookies,
      });

      // Add account to multi-account registry
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
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          puuid: tokens.puuid,
          region: tokens.region,
        },
      });
    }

    // Fallback for invalid type (should not reach here due to validation above)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );

  } catch (error) {
    log.error("Unhandled error:", error);

    return NextResponse.json(
      { error: "Internal server error during authentication" },
      { status: 500 }
    );
  }
}

// Reject all other methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for authentication." },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for authentication." },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for authentication." },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for authentication." },
    { status: 405 }
  );
}
