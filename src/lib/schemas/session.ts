/**
 * Zod schema for stored session data.
 *
 * This is the single source of truth for the SessionData shape.
 * The `SessionData` type is inferred from this schema, eliminating
 * the need for a separate TypeScript interface.
 *
 * Using `.passthrough()` for forward-compatibility: if a newer
 * version of the auth flow stores extra fields in the DB, existing
 * code won't reject them during validation.
 */
import { z } from "zod";

export const StoredSessionSchema = z.object({
  accessToken: z.string(),
  idToken: z.string().optional(),
  entitlementsToken: z.string(),
  puuid: z.string(),
  region: z.string(),
  gameName: z.string().optional(),
  tagLine: z.string().optional(),
  country: z.string().optional(),
  riotCookies: z.string().optional(),
  createdAt: z.number(),
}).passthrough();

/** Inferred type from the session schema — replaces the manual SessionData interface */
export type StoredSession = z.infer<typeof StoredSessionSchema>;
