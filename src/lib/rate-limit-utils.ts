/**
 * Rate Limit Utilities
 *
 * Helper functions for IP extraction, response headers, and rate-limited responses.
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Extracts the client IP from a Next.js request or headers object.
 * Checks x-forwarded-for first (for proxy/load balancer setups),
 * then x-real-ip, with a fallback to 127.0.0.1.
 */
export function getClientIP(requestOrHeaders: NextRequest | Headers): string {
  const headers = requestOrHeaders instanceof NextRequest
    ? requestOrHeaders.headers
    : requestOrHeaders;

  // Check x-forwarded-for header (may contain multiple IPs)
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  // Check x-real-ip header
  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Fallback
  return "127.0.0.1";
}

/**
 * Adds rate limit headers to a NextResponse.
 * Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 */
export function addRateLimitHeaders(
  response: NextResponse,
  headers: { limit: number; remaining: number; reset: number }
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(headers.limit));
  response.headers.set("X-RateLimit-Remaining", String(headers.remaining));
  response.headers.set("X-RateLimit-Reset", String(headers.reset));
  return response;
}

/**
 * Creates a 429 Too Many Requests response with rate limit headers
 * and a calculated retryAfter value.
 */
export function createRateLimitedResponse(rateLimitData: {
  limit: number;
  remaining: number;
  reset: number;
}): NextResponse {
  const retryAfter = Math.max(
    0,
    Math.ceil((rateLimitData.reset - Date.now()) / 1000)
  );

  const response = NextResponse.json(
    {
      error: "Too many authentication attempts. Please try again later.",
      retryAfter,
    },
    { status: 429 }
  );

  return addRateLimitHeaders(response, rateLimitData);
}
