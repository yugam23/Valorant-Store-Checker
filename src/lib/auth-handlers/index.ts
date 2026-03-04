/**
 * Auth Handlers Barrel Export
 *
 * Re-exports all authentication handler functions and shared types
 * for consumption by the auth route dispatcher.
 */

export { handleCredentialsAuth } from "./credentials";
export { handleMfaAuth } from "./mfa";
export { handleUrlAuth } from "./url";
export { handleCookieAuth } from "./cookie";
export { handleBrowserAuth } from "./browser";
export { AuthBodySchema, type AuthBody } from "./shared";
