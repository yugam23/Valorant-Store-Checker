import { initSessionDb } from './session-db';
import type { SessionData } from './schemas/session';
import { parseWithLog } from '@/lib/schemas/parse';
import { StoredSessionSchema } from '@/lib/schemas/session';
import { encrypt, decrypt, isEncrypted } from './session-crypto';
import { env } from './env';
import { createLogger } from '@/lib/logger';

const log = createLogger('session-store');

let warnedNoKey = false;

function getEncryptionKey(): string | null {
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    if (!warnedNoKey) {
      log.warn('ENCRYPTION_KEY not set — using fallback key. Generate a production key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      warnedNoKey = true;
    }
    return '0'.repeat(64);
  }
  if (key.length !== 64) {
    log.error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    return null;
  }
  return key;
}

export async function saveSessionToStore(sessionId: string, data: SessionData, maxAgeSeconds: number): Promise<void> {
  const db = await initSessionDb();
  const expiresAt = Date.now() + (maxAgeSeconds * 1000);

  const key = getEncryptionKey();
  let serialized: string;

  if (key && data.riotCookies) {
    const toStore = { ...data, riotCookies: encrypt(data.riotCookies, key) };
    serialized = JSON.stringify(toStore);
  } else {
    serialized = JSON.stringify(data);
  }

  await db.execute({
    sql: 'INSERT OR REPLACE INTO sessions (id, data, expires_at) VALUES (?, ?, ?)',
    args: [sessionId, serialized, expiresAt],
  });
}

export async function getSessionFromStore(sessionId: string): Promise<SessionData | null> {
  const db = await initSessionDb();

  let result: Awaited<ReturnType<typeof db.execute>>;
  try {
    result = await db.execute({
      sql: 'SELECT data, expires_at FROM sessions WHERE id = ?',
      args: [sessionId],
    });
  } catch (err) {
    log.error('session-store: database error fetching session %s:', sessionId, err);
    return null;
  }

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0]!;
  const expiresAt = row.expires_at as number;

  if (expiresAt < Date.now()) {
    await db.execute({
      sql: 'DELETE FROM sessions WHERE id = ?',
      args: [sessionId],
    });
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(row.data as string);
  } catch {
    log.warn('session-store: corrupt session data for %s — discarding', sessionId);
    return null;
  }

  // Decrypt riotCookies if present
  const rawObj = raw as Record<string, unknown>;
  if (rawObj.riotCookies) {
    const key = getEncryptionKey();

    if (isEncrypted(rawObj.riotCookies as string)) {
      if (!key) {
        log.warn('Encrypted cookies found but no ENCRYPTION_KEY — cannot decrypt, re-login required');
        return null;
      }
      try {
        rawObj.riotCookies = decrypt(rawObj.riotCookies as string, key);
      } catch (err) {
        log.warn('Failed to decrypt riotCookies (re-login required):', err);
        return null;
      }
    }
    // If NOT encrypted (legacy plaintext): leave as-is — will be re-encrypted on next save
  }

  return parseWithLog(StoredSessionSchema, raw, "StoredSession") as SessionData | null;
}

export async function deleteSessionFromStore(sessionId: string): Promise<void> {
  const db = await initSessionDb();
  await db.execute({
    sql: 'DELETE FROM sessions WHERE id = ?',
    args: [sessionId],
  });
}

export async function cleanupExpiredSessions(): Promise<void> {
  const db = await initSessionDb();
  await db.execute({
    sql: 'DELETE FROM sessions WHERE expires_at < ?',
    args: [Date.now()],
  });
}
