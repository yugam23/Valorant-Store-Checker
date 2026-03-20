/**
 * Next.js Instrumentation - ENCRYPTION_KEY validation at server startup.
 *
 * This register() function runs AFTER next build completes, NOT during build.
 * This is the ONLY safe place for production env validation that must not
 * run during `next build`.
 *
 * - Production (NODE_ENV === "production"): throws if key missing or invalid
 * - Development/Test: does nothing (session-store.ts handles fallback with warning)
 */

export async function register() {
  if (process.env.NODE_ENV === "production") {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error(
        "ENCRYPTION_KEY environment variable is required in production.\n" +
        "Generate a valid key with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        "Then set it in your environment or .env file."
      );
    }

    if (!/^[0-9a-f]{64}$/i.test(key)) {
      throw new Error(
        "ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).\n" +
        "Generate a valid key with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
  }
}
