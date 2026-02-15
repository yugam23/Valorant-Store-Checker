/**
 * Dexie.js IndexedDB database for client-side store history
 */

import Dexie, { Table } from 'dexie';
import { StoreRotation } from '@/types/history';

/**
 * ValorantDB - IndexedDB database for storing historical store rotations
 */
export class ValorantDB extends Dexie {
  // Tables
  storeRotations!: Table<StoreRotation>;

  constructor() {
    super('ValorantStoreChecker');

    // Schema version 1
    this.version(1).stores({
      // Compound index [puuid+date] enables efficient de-duplication
      storeRotations: '++id, date, puuid, [puuid+date]'
    });
  }
}

/**
 * Database instance
 * Nullable to handle graceful degradation when IndexedDB is unavailable
 * (e.g., private browsing mode, browser restrictions)
 */
export let db: ValorantDB | null = null;

try {
  db = new ValorantDB();
} catch (error) {
  console.warn('IndexedDB unavailable - store history will not be persisted:', error);
  db = null;
}
