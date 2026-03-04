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

const log = createLogger("Auth API");

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, AuthBodySchema);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    switch (body.type) {
      case "url":
        return await handleUrlAuth(body);
      case "cookie":
        return await handleCookieAuth(body);
      case "multifactor":
        return await handleMfaAuth(body);
      case "launch_browser":
        return await handleBrowserAuth(body);
      case "auth":
        return await handleCredentialsAuth(body);
    }
  } catch (error) {
    log.error("Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error during authentication" },
      { status: 500 },
    );
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
