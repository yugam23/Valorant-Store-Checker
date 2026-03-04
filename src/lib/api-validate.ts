/**
 * API Validation Helpers
 *
 * Centralized cross-cutting concerns for Route Handlers:
 * - parseBody: validates request body against a Zod schema
 * - withSession: HOF that guards a handler behind session authentication
 *
 * Usage:
 *   export const GET = withSession(async (_request, session) => { ... });
 *   export const POST = withSession(async (request, session) => {
 *     const parsed = await parseBody(request, MySchema);
 *     if (!parsed.success) return parsed.response;
 *     // use parsed.data
 *   });
 */

import { NextRequest, NextResponse } from "next/server";
import { type ZodType } from "zod";
import { getSession, getSessionWithRefresh } from "@/lib/session";
import type { SessionData } from "@/lib/session";

// ---------------------------------------------------------------------------
// parseBody
// ---------------------------------------------------------------------------

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

/**
 * Parses and validates the JSON request body against the given Zod schema.
 *
 * Returns `{ success: true, data }` when the body is valid.
 * Returns `{ success: false, response }` (a 400 NextResponse) when the body
 * is malformed JSON or fails Zod validation — callers should immediately
 * `return parsed.response` in that case.
 *
 * @example
 *   const parsed = await parseBody(request, MySchema);
 *   if (!parsed.success) return parsed.response;
 *   const data = parsed.data;
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  // 1. Try parsing the JSON body — return 400 on malformed JSON
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      ),
    };
  }

  // 2. Run Zod safeParse — return 400 with the first issue message on failure
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request body";
    return {
      success: false,
      response: NextResponse.json({ error: message }, { status: 400 }),
    };
  }

  // 3. All good — return the validated data
  return { success: true, data: result.data };
}

// ---------------------------------------------------------------------------
// withSession
// ---------------------------------------------------------------------------

type SessionHandler = (
  request: NextRequest,
  session: SessionData,
) => Promise<NextResponse>;

interface WithSessionOptions {
  /** When true, calls getSessionWithRefresh() to auto-refresh expired tokens. */
  refresh?: boolean;
}

/**
 * Higher-order function that wraps a Route Handler with session authentication.
 *
 * The returned function has the exact signature Next.js Route Handlers expect
 * (`(request: NextRequest) => Promise<NextResponse>`), so it can be exported
 * directly as `GET`, `POST`, etc.
 *
 * When no valid session exists the wrapper responds with 401 JSON
 * `{ error: "Unauthorized" }` without invoking the inner handler.
 *
 * @param handler  The actual route logic; receives the request and session.
 * @param options  Pass `{ refresh: true }` to use getSessionWithRefresh().
 *
 * @example
 *   export const GET = withSession(async (_request, session) => {
 *     return NextResponse.json({ puuid: session.puuid });
 *   });
 *
 *   export const GET = withSession(async (request, session) => {
 *     // token refresh happens automatically before handler is called
 *   }, { refresh: true });
 */
export function withSession(
  handler: SessionHandler,
  options?: WithSessionOptions,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    // 1. Retrieve session — with or without token refresh
    const session = options?.refresh
      ? await getSessionWithRefresh()
      : await getSession();

    // 2. No session → 401 Unauthorized
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Session valid → delegate to the inner handler
    return handler(request, session);
  };
}
