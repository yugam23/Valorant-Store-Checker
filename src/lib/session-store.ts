import fs from 'fs/promises';
import path from 'path';
import { SessionData } from './session-types';

const SESSION_DIR = path.join(process.cwd(), '.session-data');
const SESSION_FILE = path.join(SESSION_DIR, 'sessions.json');

// Interface for the detailed session object stored on disk
interface StoredSession {
  id: string;
  data: SessionData;
  expiresAt: number;
}

// In-memory cache to reduce file I/O
let sessionCache: Map<string, StoredSession> | null = null;

async function ensureSessionDir() {
  try {
    await fs.access(SESSION_DIR);
  } catch {
    await fs.mkdir(SESSION_DIR, { recursive: true });
  }
}

async function loadSessions(): Promise<Map<string, StoredSession>> {
  // if (sessionCache) return sessionCache; // FORCE DISK READ FOR DEBUGGING
  sessionCache = null; // Always reload from disk to ensure consistency across multiple processes/restarts/API calls during development

  await ensureSessionDir();
  try {
    const data = await fs.readFile(SESSION_FILE, 'utf-8');
    const sessions = JSON.parse(data) as StoredSession[];
    sessionCache = new Map(sessions.map(s => [s.id, s]));
  } catch (error) {
    // If file doesn't exist or is corrupt, start fresh
    sessionCache = new Map();
  }
  return sessionCache;
}

async function saveSessions(): Promise<void> {
  if (!sessionCache) return;
  await ensureSessionDir();
  const sessions = Array.from(sessionCache.values());
  await fs.writeFile(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

export async function saveSessionToStore(sessionId: string, data: SessionData, maxAgeSeconds: number): Promise<void> {
  const sessions = await loadSessions();
  const expiresAt = Date.now() + (maxAgeSeconds * 1000);
  
  sessions.set(sessionId, {
    id: sessionId,
    data,
    expiresAt
  });
  
  await saveSessions();
}

export async function getSessionFromStore(sessionId: string): Promise<SessionData | null> {
  // Always load fresh data to handle multi-tab/process updates
  sessionCache = null; 
  const sessions = await loadSessions();
  const session = sessions.get(sessionId);

  if (!session) return null;

  // Check expiration
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    await saveSessions();
    return null;
  }

  return session.data;
}

export async function deleteSessionFromStore(sessionId: string): Promise<void> {
  const sessions = await loadSessions();
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    await saveSessions();
  }
}

// Optional: Clean up expired sessions periodically
export async function cleanupExpiredSessions(): Promise<void> {
  const sessions = await loadSessions();
  const now = Date.now();
  let changed = false;

  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
      changed = true;
    }
  }

  if (changed) {
    await saveSessions();
  }
}
