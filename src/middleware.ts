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
 * - If session exists and user tries to access /login -> redirect to /store
 * - If no session and user tries to access protected routes -> redirect to /login
 * - All other routes pass through
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "valorant_session";

// Routes that require authentication
const PROTECTED_ROUTES = ["/store", "/api/store"];

// Routes that should redirect to store if already authenticated
const AUTH_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if session cookie exists
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const hasSession = !!sessionCookie;

  // If user is authenticated and tries to access login page
  if (hasSession && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const storeUrl = new URL("/store", request.url);
    return NextResponse.redirect(storeUrl);
  }

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
