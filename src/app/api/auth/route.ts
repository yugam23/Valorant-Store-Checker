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
import { createSession } from "@/lib/session";

interface LoginRequestBody {
  username?: string;
  password?: string;
  type?: "auth" | "multifactor" | "url";
  code?: string;
  cookie?: string;
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequestBody = await request.json();

    // Validate request type
    if (!body.type || (body.type !== "auth" && body.type !== "multifactor" && body.type !== "url")) {
      return NextResponse.json(
        { error: "Invalid request type. Expected 'auth', 'multifactor', or 'url'" },
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

      // Import dynamically to avoid circular deps if any (though likely none here)
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

      // Create session with tokens
      await createSession(result.tokens);

      return NextResponse.json({
        success: true,
        data: {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
        },
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

      const result = await authenticateRiotAccount(body.username, body.password);

      if (!result.success) {
        // Check if MFA is required
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

      // Authentication successful - create session
      await createSession(result.tokens);

      return NextResponse.json({
        success: true,
        data: {
          puuid: result.tokens.puuid,
          region: result.tokens.region,
        },
      });
    }

    // Fallback for invalid type (should not reach here due to validation above)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Auth API error:", error);

    return NextResponse.json(
      {
        error: "Internal server error during authentication",
        details: error instanceof Error ? error.message : "Unknown error",
      },
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
