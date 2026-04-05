/**
 * Zod schema for stored accounts data.
 *
 * This is the single source of truth for the AccountsData shape.
 * The `AccountEntry` and `AccountsData` types are inferred from this schema.
 *
 * Using `.passthrough()` for forward-compatibility: if a newer
 * version stores extra fields, existing code won't reject them during validation.
 */
import { z } from "zod";

export const AccountEntrySchema = z.object({
  puuid: z.string(),
  region: z.string(),
  gameName: z.string().optional(),
  tagLine: z.string().optional(),
  // Accept number (timestamp) or string - no transform to avoid Zod generic type inference issues
  addedAt: z.union([z.number(), z.string()]),
}).passthrough();

export const AccountsPayloadSchema = z.object({
  accounts: z.array(AccountEntrySchema),
  activePuuid: z.string().nullable(),
}).passthrough();

/** Inferred type from the accounts entry schema */
export type AccountEntry = z.infer<typeof AccountEntrySchema>;

/** Inferred type from the accounts payload schema */
export type AccountsData = z.infer<typeof AccountsPayloadSchema>;