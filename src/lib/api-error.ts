/**
 * Shared API Error Response Utilities
 *
 * Provides consistent error response shapes across all API routes.
 * Use these instead of ad-hoc `NextResponse.json({ error: ... }, { status: ... })`.
 */

import { NextResponse } from "next/server";

/**
 * Creates a standardized error response.
 *
 * @param error   - Human-readable error message
 * @param code    - Machine-readable error code (e.g., 'UNAUTHORIZED', 'NOT_FOUND')
 * @param details - Additional error details (e.g., validation issues)
 * @param status  - HTTP status code (default: 400)
 */
export function errorResponse(
  error: string,
  code?: string,
  details?: string,
  status = 400,
) {
  return NextResponse.json({ error, code, details }, { status });
}

/**
 * Returns a 401 Unauthorized response.
 */
export function unauthorizedResponse() {
  return errorResponse("Unauthorized", "UNAUTHORIZED", undefined, 401);
}

/**
 * Returns a 404 Not Found response.
 */
export function notFoundResponse(resource: string) {
  return errorResponse(`${resource} not found`, "NOT_FOUND", undefined, 404);
}

/**
 * Returns a 500 Internal Server Error response.
 */
export function serverErrorResponse(message = "Internal server error") {
  return errorResponse(message, "INTERNAL_ERROR", undefined, 500);
}

/**
 * Returns a 429 Too Many Requests response.
 */
export function rateLimitResponse(retryAfter?: number) {
  const headers: Record<string, string> = {};
  if (retryAfter !== undefined) {
    headers["Retry-After"] = Math.ceil(retryAfter).toString();
  }
  return NextResponse.json(
    { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
    { status: 429, headers },
  );
}
