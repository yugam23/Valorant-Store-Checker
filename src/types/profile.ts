import { type ProfileData } from "@/lib/profile-cache";

/**
 * Profile page data — extends ProfileData with session identity fields.
 *
 * The /api/profile endpoint merges these session fields (gameName, tagLine,
 * country, region) into the ProfileData response so the profile page has
 * everything it needs in a single fetch.
 */
export interface ProfilePageData extends ProfileData {
  gameName?: string;
  tagLine?: string;
  country?: string;
  region?: string;
}
