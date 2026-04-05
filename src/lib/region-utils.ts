/**
 * Shared Region Mapping Utilities
 *
 * Consolidates region mapping logic from:
 * - `determineRegion()` in riot-tokens.ts (country code → Riot region)
 * - `toHenrikRegion()` in henrik-api.ts (Riot region → Henrik API region)
 *
 * Henrik API supports: eu, na, latam, br, ap, kr
 * Riot may return shards like "ind", "as", "oce", "jp", "ru", "tr" that need mapping.
 */

import { type UserInfo } from "@/lib/riot-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("region-utils");

/**
 * Maps a Riot region/shard to a Henrik API region.
 * Henrik only supports: eu, na, latam, br, ap, kr
 * Unknown regions fallback to 'na'.
 */
export const HENRIK_REGION_MAP = {
  na: "na",
  eu: "eu",
  ap: "ap",
  kr: "kr",
  latam: "na",
  br: "na",
} as const;

export type HenrikRegion = (typeof HENRIK_REGION_MAP)[keyof typeof HENRIK_REGION_MAP];

/**
 * Converts a Riot region/shard to a Henrik-compatible region.
 * Falls back to 'na' for unknown regions.
 */
export function toHenrikRegion(region: string): string {
  const mapped = HENRIK_REGION_MAP[region.toLowerCase() as keyof typeof HENRIK_REGION_MAP];
  if (mapped) return mapped;

  // Handle non-standard Riot shards that Henrik doesn't support
  const legacyMap: Record<string, string> = {
    ind: "ap",
    as: "ap",
    oce: "ap",
    jp: "ap",
    ru: "eu",
    tr: "eu",
  };

  const legacy = legacyMap[region.toLowerCase()];
  if (legacy) {
    log.debug(`Mapped legacy region ${region} to Henrik region ${legacy}`);
    return legacy;
  }

  log.warn(`Unknown region ${region}, falling back to na`);
  return "na";
}

/**
 * Country code to Riot region mapping (for determineRegion fallback).
 * Covers all countries referenced in the existing determineRegion implementation.
 */
const COUNTRY_TO_REGION: Record<string, string> = {
  // North America
  US: "na",
  USA: "na",
  CA: "na",
  CAN: "na",
  MX: "na",
  MEX: "na",

  // Europe
  GB: "eu",
  GBR: "eu",
  DE: "eu",
  DEU: "eu",
  FR: "eu",
  FRA: "eu",
  IT: "eu",
  ITA: "eu",
  ES: "eu",
  ESP: "eu",
  RU: "eu",
  RUS: "eu",
  TR: "eu",
  TUR: "eu",
  PL: "eu",
  POL: "eu",
  NL: "eu",
  NLD: "eu",
  SE: "eu",
  SWE: "eu",
  NO: "eu",
  NOR: "eu",
  DK: "eu",
  DNK: "eu",
  FI: "eu",
  FIN: "eu",
  UA: "eu",
  UKR: "eu",

  // Asia Pacific
  JP: "ap",
  JPN: "ap",
  KR: "kr",
  KOR: "kr",
  CN: "ap",
  CHN: "ap",
  TW: "ap",
  TWN: "ap",
  HK: "ap",
  HKG: "ap",
  SG: "ap",
  SGP: "ap",
  TH: "ap",
  THA: "ap",
  VN: "ap",
  VNM: "ap",
  ID: "ap",
  IDN: "ap",
  MY: "ap",
  MYS: "ap",
  PH: "ap",
  PHL: "ap",
  IN: "ap",
  IND: "ap",
  AU: "ap",
  AUS: "ap",
  NZ: "ap",
  NZL: "ap",

  // Latin America
  BR: "br",
  BRA: "br",
  AR: "latam",
  ARG: "latam",
  CL: "latam",
  CHL: "latam",
  CO: "latam",
  COL: "latam",
  PE: "latam",
  PER: "latam",
};

/**
 * Determines the game region/shard from user information.
 * @param userInfo User information object (from Riot auth response)
 * @returns Region identifier (na, eu, ap, kr, latam, br)
 */
export function determineRegion(userInfo: UserInfo): string {
  log.debug(
    "Determining region. Country:",
    userInfo.country,
    "Affinity:",
    JSON.stringify(userInfo.affinity),
  );

  // Primary: use the affinity field which contains the actual shard assignment
  // The "pp" key (player platform) maps directly to the PD shard
  if (userInfo.affinity) {
    const shard =
      userInfo.affinity.pp ||
      userInfo.affinity.live ||
      Object.values(userInfo.affinity)[0];
    if (shard) {
      log.info(`Using affinity shard: ${shard}`);
      return shard;
    }
  }

  // Fallback to country-based mapping
  const countryCode = userInfo.country?.toUpperCase();
  const region = countryCode ? COUNTRY_TO_REGION[countryCode] : undefined;

  if (region) {
    log.info(`Mapped country ${countryCode} to region ${region}`);
    return region;
  }

  log.warn(`Unknown country code: ${countryCode}, defaulting to 'na'`);
  return "na";
}
