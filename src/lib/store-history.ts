/**
 * Store history CRUD utilities
 * Handles logging, querying, stats, and pruning of historical store rotations
 */

import { db } from './db';
import { StoreRotation, HistoryStoreItem, HistoryStats } from '@/types/history';
import { StoreItem } from '@/types/store';

/**
 * Log a store rotation to IndexedDB
 * De-duplicates by puuid+date to prevent multiple entries per day
 *
 * @param puuid - Player UUID
 * @param items - Store items from the daily rotation
 * @param expiresAt - When this rotation expires
 */
export async function logStoreRotation(
  puuid: string,
  items: StoreItem[],
  expiresAt: Date,
  account?: { gameName?: string; tagLine?: string }
): Promise<void> {
  // Graceful degradation when IndexedDB unavailable
  if (!db) {
    return;
  }

  // Compute today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Check for existing rotation (de-duplication)
  const existing = await db.storeRotations
    .where('[puuid+date]')
    .equals([puuid, today])
    .first();

  if (existing) {
    // Already logged today - skip
    return;
  }

  // Map StoreItem to HistoryStoreItem (keep only essential fields)
  const historyItems: HistoryStoreItem[] = items.map((item) => ({
    uuid: item.uuid,
    displayName: item.displayName,
    cost: item.cost,
    tierName: item.tierName,
    tierColor: item.tierColor,
  }));

  // Create rotation record
  const rotation: StoreRotation = {
    date: today,
    timestamp: Date.now(),
    puuid,
    gameName: account?.gameName,
    tagLine: account?.tagLine,
    items: historyItems,
    expiresAt: expiresAt.getTime(),
  };

  // Add to database
  await db.storeRotations.add(rotation);
}

/**
 * Query store history for a specific player
 *
 * @param puuid - Player UUID
 * @param options - Query options (date range, limit)
 * @returns Array of store rotations, newest first
 */
export async function getStoreHistory(
  puuid: string,
  options?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    limit?: number;
  }
): Promise<StoreRotation[]> {
  if (!db) {
    return [];
  }

  let query = db.storeRotations.where('puuid').equals(puuid);

  // Apply date range filter if provided
  if (options?.startDate || options?.endDate) {
    query = query.filter((rotation) => {
      if (options.startDate && rotation.date < options.startDate) {
        return false;
      }
      if (options.endDate && rotation.date > options.endDate) {
        return false;
      }
      return true;
    });
  }

  // Reverse sort (newest first) and apply limit
  const rotations = await query.reverse().sortBy('date');

  const limit = options?.limit ?? 100;
  return rotations.slice(0, limit);
}

/**
 * Calculate aggregated statistics for a player's store history
 *
 * @param puuid - Player UUID
 * @returns Stats object with rotation count, unique skins, most offered, avg cost
 */
export async function getHistoryStats(puuid: string): Promise<HistoryStats> {
  if (!db) {
    return {
      totalRotationsSeen: 0,
      uniqueSkinsOffered: 0,
      mostOfferedSkin: {
        uuid: '',
        displayName: 'N/A',
        count: 0,
      },
      averageDailyCost: 0,
    };
  }

  const rotations = await db.storeRotations.where('puuid').equals(puuid).toArray();

  const totalRotationsSeen = rotations.length;

  // Count unique skin UUIDs
  const skinUuids = new Set<string>();
  const skinCounts = new Map<string, { displayName: string; count: number }>();
  let totalCost = 0;

  for (const rotation of rotations) {
    for (const item of rotation.items) {
      skinUuids.add(item.uuid);
      totalCost += item.cost;

      // Track frequency
      const existing = skinCounts.get(item.uuid);
      if (existing) {
        existing.count++;
      } else {
        skinCounts.set(item.uuid, {
          displayName: item.displayName,
          count: 1,
        });
      }
    }
  }

  const uniqueSkinsOffered = skinUuids.size;

  // Find most frequently offered skin
  let mostOfferedSkin = {
    uuid: '',
    displayName: 'N/A',
    count: 0,
  };

  for (const [uuid, data] of skinCounts.entries()) {
    if (data.count > mostOfferedSkin.count) {
      mostOfferedSkin = {
        uuid,
        displayName: data.displayName,
        count: data.count,
      };
    }
  }

  // Calculate average daily cost (total cost of all items / number of rotations)
  const averageDailyCost = totalRotationsSeen > 0 ? totalCost / totalRotationsSeen : 0;

  return {
    totalRotationsSeen,
    uniqueSkinsOffered,
    mostOfferedSkin,
    averageDailyCost,
  };
}

/**
 * Delete a single rotation by its ID
 */
export async function deleteRotation(id: number): Promise<void> {
  if (!db) return;
  await db.storeRotations.delete(id);
}

/**
 * Prune old history entries to prevent database bloat
 *
 * @param puuid - Player UUID
 * @param keepDays - Number of days to keep (default: 90)
 * @returns Number of entries deleted
 */
export async function pruneOldHistory(
  puuid: string,
  keepDays: number = 90
): Promise<number> {
  if (!db) {
    return 0;
  }

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];

  // Delete entries older than cutoff
  const deleted = await db.storeRotations
    .where('[puuid+date]')
    .between([puuid, '0000-00-00'], [puuid, cutoffDateString], false, true)
    .delete();

  return deleted;
}
