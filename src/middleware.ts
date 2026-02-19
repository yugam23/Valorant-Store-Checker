/**
 * Next.js Middleware
 *
 * Protects routes that require authentication by checking for session cookies.
 *
 * Protected routes:
 * - /store - Main store page
 * - /api/store - Store API endpoints
 *
 * Logic:
 * - If no session cookie and user tries to access protected routes -> redirect to /login
 * - Login page redirect (authenticated -> /store) is handled by the login page itself
 *   via getSession(), which properly validates both cookie AND server-side store.
 * - All other routes pass through
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "valorant_session";

// Routes that require authentication
const PROTECTED_ROUTES = ["/store", "/api/store", "/inventory", "/api/inventory", "/api/profile", "/profile"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if session cookie exists
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const hasSession = !!sessionCookie;

  // Note: We do NOT redirect authenticated users away from /login in middleware,
  // because middleware can only check cookie existence, not session store validity.
  // The login page itself checks getSession() and redirects to /store if truly valid.

  // If user is not authenticated and tries to access protected route
  if (!hasSession && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Allow request to proceed
  return NextResponse.next();
}

// Configure which routes should run middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
