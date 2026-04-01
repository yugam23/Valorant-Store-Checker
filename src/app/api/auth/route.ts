/**
 * Authentication API Route
 *
 * Thin dispatcher that validates the request body, then delegates
 * to the appropriate handler module in src/lib/auth-handlers/.
 *
 * Endpoints:
 * - POST /api/auth — Login with credentials, MFA, URL, cookie, or browser
 */

import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/api-validate";
import { createLogger } from "@/lib/logger";
import {
  AuthBodySchema,
  handleCredentialsAuth,
  handleMfaAuth,
  handleUrlAuth,
  handleCookieAuth,
  handleBrowserAuth,
} from "@/lib/auth-handlers";
import { rateLimit } from "@/lib/rate-limiter";
import { getClientIP, addRateLimitHeaders, createRateLimitedResponse } from "@/lib/rate-limit-utils";

const log = createLogger("Auth API");

export async function POST(request: NextRequest) {
  // Rate limit check before any auth processing
  const ip = getClientIP(request);
  const { success, limit, remaining, reset } = await rateLimit(ip);
  if (!success) {
    return createRateLimitedResponse({ limit, remaining, reset });
  }

  try {
    const parsed = await parseBody(request, AuthBodySchema);
    if (!parsed.success) {
      const response = parsed.response;
      return addRateLimitHeaders(response, { limit, remaining, reset });
    }

    const body = parsed.data;

    switch (body.type) {
      case "url": {
        const response = await handleUrlAuth(body);
        return addRateLimitHeaders(response, { limit, remaining, reset });
      }
      case "cookie": {
        const response = await handleCookieAuth(body, request.headers);
        return addRateLimitHeaders(response, { limit, remaining, reset });
      }
      case "multifactor": {
        const response = await handleMfaAuth(body);
        return addRateLimitHeaders(response, { limit, remaining, reset });
      }
      case "launch_browser": {
        const response = await handleBrowserAuth(body);
        return addRateLimitHeaders(response, { limit, remaining, reset });
      }
      case "auth": {
        const response = await handleCredentialsAuth(body);
        return addRateLimitHeaders(response, { limit, remaining, reset });
      }
    }
  } catch (error) {
    log.error("Unhandled error:", error);
    const response = NextResponse.json(
      { error: "Internal server error during authentication" },
      { status: 500 },
    );
    return addRateLimitHeaders(response, { limit, remaining, reset });
  }
}

// Reject all other methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for authentication." },
    { status: 405 },
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for authentication." },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for authentication." },
    { status: 405 },
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for authentication." },
    { status: 405 },
  );
}
