/**
 * Riot PD Loadout API Client
 *
 * Fetches the player's equipped loadout (player card, title, level border)
 * from the Riot PD /personalization endpoint.
 *
 * This is a direct API call — caching is handled at the profile-cache level.
 */

import { StoreTokens, fetchWithShardFallback } from "./riot-store";
import { createLogger } from "./logger";

const log = createLogger("riot-loadout");

/** Identity section of the player loadout (card, title, level) */
export interface PlayerLoadoutIdentity {
  PlayerCardID: string;
  PlayerTitleID: string;
  AccountLevel: number;
  PreferredLevelBorderID: string;
  HideAccountLevel: boolean;
}

/**
 * Response from /personalization/v2/players/{puuid}/playerloadout
 * Guns and Sprays are omitted — only Identity is needed for the profile feature.
 */
export interface PlayerLoadoutResponse {
  Subject: string;
  Version: number;
  Identity: PlayerLoadoutIdentity;
  Incognito: boolean;
}

/**
 * Fetch the player's equipped loadout from the Riot PD endpoint.
 * Uses fetchWithShardFallback from riot-store for shard discovery and correct headers.
 *
 * Endpoint: /personalization/v2/players/{puuid}/playerloadout
 */
export async function getPlayerLoadout(tokens: StoreTokens): Promise<PlayerLoadoutResponse> {
  const response = await fetchWithShardFallback(
    tokens,
    (pdUrl) => `${pdUrl}/personalization/v2/players/${tokens.puuid}/playerloadout`
  );

  if (!response.ok) {
    log.error("Loadout fetch failed with status:", response.status);
    throw new Error("Loadout fetch failed: " + response.status);
  }

  log.info("Player loadout fetched successfully for PUUID:", tokens.puuid.substring(0, 8));
  return response.json() as Promise<PlayerLoadoutResponse>;
}
