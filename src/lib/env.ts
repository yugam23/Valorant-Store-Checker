/**
 * Environment Variable Validation
 *
 * Validates required environment variables at import time.
 * Throws at build / startup if any required variable is missing,
 * preventing silent failures at runtime.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   const secret = env.SESSION_SECRET; // guaranteed to be a string
 */

function requiredInProduction(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `❌ Missing required environment variable: ${key}. ` +
      `Set it in your environment or .env file before deploying.`
    );
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(
    `❌ Missing required environment variable: ${key}. ` +
    `Set it in your .env.local file for development.`
  );
}

/**
 * Validated environment configuration.
 * Import this instead of reading process.env directly.
 */
export const env = {
  /** Secret key for encrypting session JWTs. Must be set in production. */
  SESSION_SECRET: requiredInProduction("SESSION_SECRET", "dev-only-insecure-secret"),

  /** Current runtime environment */
  NODE_ENV: (process.env.NODE_ENV ?? "development") as "development" | "production" | "test",

  /** Optional: override the minimum log level (debug | info | warn | error) */
  LOG_LEVEL: process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error" | undefined,

  /** Optional: Henrik API key for rank/level data. Profile degrades gracefully without it. */
  HENRIK_API_KEY: process.env.HENRIK_API_KEY ?? "",
} as const;
