/**
 * SQLite Session Database
 *
 * Provides a global-singleton libsql Client for server-side session persistence.
 * On first call to initSessionDb():
 *   1. Creates the database file at the configured path
 *   2. Initialises the sessions schema (CREATE TABLE IF NOT EXISTS + index)
 *   3. Deletes expired sessions (expires_at < now)
 *   4. Migrates any existing sessions.json data (renames to .migrated after import)
 *
 * Subsequent calls return the already-resolved Client instantly via cached promise.
 *
 * NOTE: This file is intentionally separate from src/lib/db.ts, which is the
 * Dexie/IndexedDB client for client-side store history and must not be touched.
 */

import { createClient, type Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

import type { SessionData } from './schemas/session';
import { createLogger } from "./logger";
const log = createLogger("session-db");

// ---------------------------------------------------------------------------
// Connection resolution
// ---------------------------------------------------------------------------
// In production (Vercel), set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN env vars.
// In development, falls back to a local SQLite file.
// ---------------------------------------------------------------------------

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

const isRemote = !!tursoUrl;

let dbUrl: string;
if (isRemote) {
  dbUrl = tursoUrl!;
} else {
  const dbRelPath = process.env.SESSION_DB_PATH ?? '.session-data/sessions.db';
  const dbAbsPath = path.join(process.cwd(), dbRelPath);
  // CRITICAL for Windows: backslashes in file: URLs break libsql
  dbUrl = 'file:' + dbAbsPath.replace(/\\/g, '/');
  // Only create the directory when using a local file (Vercel FS is read-only)
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path derived from server-controlled env var with safe hardcoded default; not user input
  fs.mkdirSync(path.dirname(dbAbsPath), { recursive: true });
}

// ---------------------------------------------------------------------------
// Cleanup interval
// ---------------------------------------------------------------------------

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Global singleton (Next.js hot-reload safe)
// ---------------------------------------------------------------------------

declare global {
  var __sessionDb: Client | undefined;
  var __cleanupInterval: ReturnType<typeof setInterval> | undefined;
}

function getOrCreateClient(): Client {
  if (!global.__sessionDb) {
    global.__sessionDb = createClient({
      url: dbUrl,
      ...(isRemote && tursoToken ? { authToken: tursoToken } : {}),
    });
  }
  return global.__sessionDb;
}

// ---------------------------------------------------------------------------
// Schema SQL
// ---------------------------------------------------------------------------

const CREATE_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT    PRIMARY KEY,
    data       TEXT    NOT NULL,
    expires_at INTEGER NOT NULL
  )
`.trim();

const CREATE_SESSIONS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)
`.trim();

// ---------------------------------------------------------------------------
// Migration from sessions.json
// ---------------------------------------------------------------------------

interface JsonSession {
  id: string;
  data: SessionData | Record<string, unknown>;
  expiresAt: number;
}

async function migrateFromJsonIfNeeded(client: Client): Promise<void> {
  const jsonPath = path.join(process.cwd(), '.session-data', 'sessions.json');

  if (!fs.existsSync(jsonPath)) {
    return;
  }

  // Only migrate into an empty table to avoid duplicates
  const countResult = await client.execute('SELECT COUNT(*) as count FROM sessions');
  const count = Number(countResult.rows[0]?.count ?? 0);
  if (count > 0) {
    return;
  }

  let sessions: JsonSession[];
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    sessions = JSON.parse(raw) as JsonSession[];
  } catch {
    // Malformed JSON — skip migration, don't crash startup
    log.warn('Failed to parse sessions.json — skipping migration');
    return;
  }

  const now = Date.now();
  const valid = sessions.filter((s) => s.expiresAt > now);

  for (const session of valid) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO sessions (id, data, expires_at) VALUES (?, ?, ?)',
      args: [session.id, JSON.stringify(session.data), session.expiresAt],
    });
  }

  // Rename the source file so migration doesn't run again
  fs.renameSync(jsonPath, jsonPath + '.migrated');

  log.info(
    `Migrated ${valid.length} session(s) from sessions.json → sessions.json.migrated`
  );
}

// ---------------------------------------------------------------------------
// Init (lazy, cached promise)
// ---------------------------------------------------------------------------

let _initPromise: Promise<Client> | null = null;

/**
 * Returns an initialised SQLite Client.
 * The first call creates the schema, cleans expired rows, and runs migration.
 * All subsequent calls resolve instantly from the cached promise.
 */
export function initSessionDb(): Promise<Client> {
  if (!_initPromise) {
    _initPromise = (async () => {
      const client = getOrCreateClient();

      // 1. Schema initialisation
      await client.batch(
        [
          { sql: CREATE_SESSIONS_TABLE, args: [] },
          { sql: CREATE_SESSIONS_INDEX, args: [] },
        ],
        'write'
      );

      // 2. Expired-session cleanup (SQLITE-06)
      const cleanupResult = await client.execute({
        sql: 'DELETE FROM sessions WHERE expires_at < ?',
        args: [Date.now()],
      });
      if (cleanupResult.rowsAffected > 0) {
        log.info(
          'Startup cleanup removed %d expired session(s)',
          cleanupResult.rowsAffected,
        );
      }

      // 3. Migration from sessions.json (SQLITE-04)
      await migrateFromJsonIfNeeded(client);

      // 4. Schedule periodic cleanup (hot-reload safe)
      if (global.__cleanupInterval) {
        clearInterval(global.__cleanupInterval);
      }
      global.__cleanupInterval = setInterval(async () => {
        try {
          const count = await client.execute({
            sql: 'DELETE FROM sessions WHERE expires_at < ?',
            args: [Date.now()],
          });
          if (count.rowsAffected > 0) {
            log.info(
              'Periodic cleanup removed %d expired session(s)',
              count.rowsAffected,
            );
          }
        } catch (err) {
          log.warn('Periodic session cleanup failed:', err);
        }
      }, CLEANUP_INTERVAL_MS);

      // Prevent setInterval from keeping the process alive during shutdown
      if (global.__cleanupInterval.unref) {
        global.__cleanupInterval.unref();
      }

      return client;
    })();
  }
  return _initPromise;
}
