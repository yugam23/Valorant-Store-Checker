/**
 * Types for store history tracking
 */

/**
 * Simplified store item structure for history logging
 * Only captures essential display and pricing information
 */
export interface HistoryStoreItem {
  uuid: string;
  displayName: string;
  cost: number;
  tierName: string | null;
  tierColor: string;
}

/**
 * Store rotation record stored in IndexedDB
 * Represents a single day's store offerings for one account
 */
export interface StoreRotation {
  id?: number; // Auto-increment primary key
  date: string; // YYYY-MM-DD format
  timestamp: number; // Unix timestamp in milliseconds
  puuid: string; // Player UUID
  gameName?: string; // Riot display name (e.g. "PlayerName")
  tagLine?: string; // Riot tag (e.g. "NA1")
  items: HistoryStoreItem[]; // The 4 daily store items
  expiresAt: number; // When this rotation expires (unix timestamp ms)
}

/**
 * Aggregated statistics across store history
 */
export interface HistoryStats {
  totalRotationsSeen: number;
  uniqueSkinsOffered: number;
  mostOfferedSkin: {
    uuid: string;
    displayName: string;
    count: number;
  };
  averageDailyCost: number;
}
