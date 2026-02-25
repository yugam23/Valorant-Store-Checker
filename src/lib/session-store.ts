import { initSessionDb } from './session-db';
import { SessionData } from './session-types';

export async function saveSessionToStore(sessionId: string, data: SessionData, maxAgeSeconds: number): Promise<void> {
  const db = await initSessionDb();
  const expiresAt = Date.now() + (maxAgeSeconds * 1000);
  await db.execute({
    sql: 'INSERT OR REPLACE INTO sessions (id, data, expires_at) VALUES (?, ?, ?)',
    args: [sessionId, JSON.stringify(data), expiresAt],
  });
}

export async function getSessionFromStore(sessionId: string): Promise<SessionData | null> {
  const db = await initSessionDb();
  const result = await db.execute({
    sql: 'SELECT data, expires_at FROM sessions WHERE id = ?',
    args: [sessionId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const expiresAt = row.expires_at as number;

  if (expiresAt < Date.now()) {
    await db.execute({
      sql: 'DELETE FROM sessions WHERE id = ?',
      args: [sessionId],
    });
    return null;
  }

  return JSON.parse(row.data as string) as SessionData;
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
