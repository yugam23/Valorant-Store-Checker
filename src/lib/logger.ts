/**
 * Structured Logger Utility
 *
 * Provides consistent, filterable logging across the application.
 * Each logger instance is tagged with a context label (e.g., "riot-auth", "riot-store").
 *
 * Log levels: debug < info < warn < error
 * - In production, only warn/error are emitted by default.
 * - In development, all levels are active.
 *
 * Usage:
 *   import { createLogger } from "@/lib/logger";
 *   const log = createLogger("riot-auth");
 *   log.info("Step 1 - Init status:", status);
 *   log.warn("Shard failed", { region, status: 404 });
 *   log.error("Fatal failure", error);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Minimum log level threshold.
 * - production  → "warn"  (only warn + error are emitted)
 * - development → "debug" (everything is emitted)
 *
 * Override via LOG_LEVEL env var if needed.
 */
function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) return envLevel;
  return process.env.NODE_ENV === "production" ? "warn" : "debug";
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Creates a logger scoped to the given context tag.
 * @param context A short identifier, e.g. "riot-auth", "Store API"
 */
export function createLogger(context: string): Logger {
  const minLevel = getMinLevel();
  const prefix = `[${context}]`;

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
  }

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) console.debug(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) console.log(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) console.error(prefix, ...args);
    },
  };
}
